-- Permite que o proprietário abra uma solicitação de O.S. diretamente pelo app.
create or replace function public.get_order_request_workshops()
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select w.id, w.name
  from public.workshops w
  order by w.name;
$$;

create or replace function public.create_owner_service_request(
  p_workshop_id uuid,
  p_owner_vehicle_id uuid,
  p_complaint text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  v_client_id uuid;
  v_vehicle_id uuid;
  owner_vehicle public.owner_vehicles%rowtype;
  owner_name text;
  owner_email text;
  owner_phone text;
begin
  if auth.uid() is null then
    raise exception 'Entre novamente para abrir a solicitação.';
  end if;

  if nullif(trim(p_complaint), '') is null or char_length(trim(p_complaint)) < 4 then
    raise exception 'Descreva o problema do veículo com pelo menos 4 caracteres.';
  end if;

  select * into owner_vehicle
  from public.owner_vehicles
  where id = p_owner_vehicle_id and owner_id = auth.uid();

  if owner_vehicle.id is null then
    raise exception 'Veículo não encontrado na sua conta.';
  end if;

  if not exists (select 1 from public.workshops where id = p_workshop_id) then
    raise exception 'Oficina não encontrada.';
  end if;

  select p.full_name, lower(u.email), vo.phone
    into owner_name, owner_email, owner_phone
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.vehicle_owners vo on vo.user_id = u.id
  where u.id = auth.uid();

  select c.id into v_client_id
  from public.client_portal_links link
  join public.clients c on c.id = link.client_id
  where link.user_id = auth.uid() and c.workshop_id = p_workshop_id
  limit 1;

  if v_client_id is null and owner_email is not null then
    select c.id into v_client_id
    from public.clients
    where workshop_id = p_workshop_id and lower(coalesce(email, '')) = owner_email
    limit 1;
  end if;

  if v_client_id is null then
    insert into public.clients(workshop_id, full_name, phone, whatsapp, email)
    values (
      p_workshop_id,
      coalesce(nullif(trim(owner_name), ''), 'Cliente CR Connect'),
      nullif(trim(owner_phone), ''),
      nullif(trim(owner_phone), ''),
      owner_email
    )
    returning id into v_client_id;
  end if;

  insert into public.client_portal_links(client_id, user_id)
  values (v_client_id, auth.uid())
  on conflict (client_id) do update set user_id = excluded.user_id;

  select v.id into v_vehicle_id
  from public.vehicles v
  where v.workshop_id = p_workshop_id
    and v.client_id = v_client_id
    and coalesce(upper(v.plate), '') = coalesce(upper(owner_vehicle.plate), '')
    and lower(v.model) = lower(owner_vehicle.model)
  limit 1;

  if v_vehicle_id is null then
    insert into public.vehicles(workshop_id, client_id, plate, brand, model, year_model)
    values (
      p_workshop_id,
      v_client_id,
      nullif(upper(trim(coalesce(owner_vehicle.plate, ''))), ''),
      coalesce(nullif(trim(owner_vehicle.brand), ''), 'Não informado'),
      owner_vehicle.model,
      owner_vehicle.year
    )
    returning id into v_vehicle_id;
  end if;

  insert into public.service_requests(workshop_id, client_id, vehicle_id, owner_id, complaint)
  values (p_workshop_id, v_client_id, v_vehicle_id, auth.uid(), trim(p_complaint))
  returning id into request_id;

  perform public.notify_workshop_members(
    p_workshop_id,
    'Nova solicitação de O.S.',
    'Um cliente abriu uma solicitação de atendimento.'
  );

  return request_id;
end;
$$;

grant execute on function public.get_order_request_workshops() to authenticated;
grant execute on function public.create_owner_service_request(uuid, uuid, text) to authenticated;
