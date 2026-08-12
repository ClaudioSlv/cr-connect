alter table public.notifications
  add column if not exists sos_request_id uuid references public.sos_requests(id) on delete cascade;

alter table public.sos_requests
  add column if not exists viewed_at timestamptz;

create index if not exists notifications_sos_request_id_idx
  on public.notifications (sos_request_id)
  where sos_request_id is not null;

create or replace function public.get_active_sos_workshops()
returns table (id uuid, name text, whatsapp text, latitude numeric, longitude numeric, emergency_services text[], emergency_radius_km integer)
language sql
security definer
set search_path = public
as $$
  select
    w.id,
    w.name,
    coalesce(nullif(trim(w.whatsapp), ''), nullif(trim(w.phone), '')) as whatsapp,
    w.latitude,
    w.longitude,
    w.emergency_services,
    w.emergency_radius_km
  from public.workshops w
  join public.subscriptions s on s.workshop_id = w.id
  where w.emergency_enabled = true
    and w.latitude is not null
    and w.longitude is not null
    and s.plan_code = 'premium'
    and s.status = 'active';
$$;

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
    select 1 from public.workshops w
    join public.subscriptions s on s.workshop_id = w.id
    where w.id = p_workshop_id
      and w.emergency_enabled = true
      and s.plan_code = 'premium'
      and s.status = 'active'
  ) then
    raise exception 'Esta oficina não está disponível para CR SOS.';
  end if;

  if auth.uid() is not null and exists (select 1 from public.vehicle_owners where user_id = auth.uid()) then
    v_owner_id := auth.uid();
  end if;

  insert into public.sos_requests (
    workshop_id, owner_id, requester_name, requester_phone,
    service_type, description, latitude, longitude
  ) values (
    p_workshop_id, v_owner_id, left(trim(p_requester_name), 100),
    nullif(left(trim(coalesce(p_requester_phone, '')), 30), ''),
    left(trim(p_service_type), 80), nullif(left(trim(coalesce(p_description, '')), 500), ''),
    p_latitude, p_longitude
  ) returning id into v_request_id;

  insert into public.notifications (workshop_id, user_id, title, body, sos_request_id)
  select
    p_workshop_id,
    wu.user_id,
    'Novo chamado CR SOS',
    'Um motorista pediu ajuda: ' || left(trim(p_service_type), 80),
    v_request_id
  from public.workshop_users wu
  where wu.workshop_id = p_workshop_id;

  return v_request_id;
end;
$$;

create or replace function public.acknowledge_sos_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sos_requests
  set viewed_at = coalesce(viewed_at, now()), updated_at = now()
  where id = p_request_id
    and exists (
      select 1 from public.workshop_users wu
      where wu.workshop_id = sos_requests.workshop_id
        and wu.user_id = auth.uid()
    );
  return found;
end;
$$;

grant execute on function public.acknowledge_sos_request(uuid) to authenticated;

create or replace function public.get_sos_request_ack(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.sos_requests
    where id = p_request_id and viewed_at is not null
  );
$$;

grant execute on function public.get_sos_request_ack(uuid) to anon, authenticated;
