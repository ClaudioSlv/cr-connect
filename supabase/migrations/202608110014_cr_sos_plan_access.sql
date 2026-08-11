create or replace function public.get_active_sos_workshops()
returns table (id uuid, name text, whatsapp text, latitude numeric, longitude numeric, emergency_services text[], emergency_radius_km integer)
language sql security definer set search_path = public as $$
  select w.id, w.name, coalesce(w.whatsapp, w.phone), w.latitude, w.longitude, w.emergency_services, w.emergency_radius_km
  from public.workshops w
  join public.subscriptions s on s.workshop_id = w.id
  where w.emergency_enabled = true and w.latitude is not null and w.longitude is not null
    and s.plan_code = 'premium' and s.status = 'active';
$$;

create or replace function public.create_sos_request(p_workshop_id uuid, p_requester_name text, p_requester_phone text, p_service_type text, p_description text, p_latitude numeric, p_longitude numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_request_id uuid;
begin
  if length(trim(coalesce(p_requester_name, ''))) < 2 or length(trim(coalesce(p_service_type, ''))) < 2 then raise exception 'Informe seu nome e o tipo de ajuda.'; end if;
  if not exists (select 1 from public.workshops w join public.subscriptions s on s.workshop_id=w.id where w.id=p_workshop_id and w.emergency_enabled=true and s.plan_code='premium' and s.status='active') then raise exception 'Esta oficina não está disponível para CR SOS.'; end if;
  insert into public.sos_requests (workshop_id, requester_name, requester_phone, service_type, description, latitude, longitude)
  values (p_workshop_id, left(trim(p_requester_name),100), nullif(left(trim(coalesce(p_requester_phone,'')),30),''), left(trim(p_service_type),80), nullif(left(trim(coalesce(p_description,'')),500),''), p_latitude, p_longitude)
  returning id into v_request_id;
  perform public.notify_workshop_members(p_workshop_id, 'Novo chamado CR SOS', 'Um motorista pediu ajuda: ' || left(trim(p_service_type),80));
  return v_request_id;
end;
$$;
