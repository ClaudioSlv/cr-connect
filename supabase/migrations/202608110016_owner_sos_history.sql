alter table public.sos_requests
  add column if not exists owner_id uuid references public.vehicle_owners(user_id) on delete set null;

create index if not exists sos_requests_owner_id_created_at_idx
  on public.sos_requests (owner_id, created_at desc);

drop policy if exists "vehicle owner reads own sos" on public.sos_requests;
create policy "vehicle owner reads own sos"
on public.sos_requests for select
using (owner_id = auth.uid());

create or replace function public.create_sos_request(
  p_workshop_id uuid,
  p_requester_name text,
  p_requester_phone text,
  p_service_type text,
  p_description text,
  p_latitude numeric,
  p_longitude numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_owner_id uuid;
begin
  if length(trim(coalesce(p_requester_name, ''))) < 2
    or length(trim(coalesce(p_service_type, ''))) < 2 then
    raise exception 'Informe seu nome e o tipo de ajuda.';
  end if;

  if not exists (
    select 1
    from public.workshops w
    join public.subscriptions s on s.workshop_id = w.id
    where w.id = p_workshop_id
      and w.emergency_enabled = true
      and s.plan_code = 'premium'
      and s.status = 'active'
  ) then
    raise exception 'Esta oficina não está disponível para CR SOS.';
  end if;

  if auth.uid() is not null and exists (
    select 1 from public.vehicle_owners where user_id = auth.uid()
  ) then
    v_owner_id := auth.uid();
  end if;

  insert into public.sos_requests (
    workshop_id, owner_id, requester_name, requester_phone,
    service_type, description, latitude, longitude
  )
  values (
    p_workshop_id, v_owner_id, left(trim(p_requester_name), 100),
    nullif(left(trim(coalesce(p_requester_phone, '')), 30), ''),
    left(trim(p_service_type), 80),
    nullif(left(trim(coalesce(p_description, '')), 500), ''),
    p_latitude, p_longitude
  )
  returning id into v_request_id;

  perform public.notify_workshop_members(
    p_workshop_id,
    'Novo chamado CR SOS',
    'Um motorista pediu ajuda: ' || left(trim(p_service_type), 80)
  );
  return v_request_id;
end;
$$;

grant execute on function public.create_sos_request(uuid, text, text, text, text, numeric, numeric)
to anon, authenticated;
