drop function public.get_active_sos_workshops();
create function public.get_active_sos_workshops()
returns table (id uuid, name text, whatsapp text, latitude numeric, longitude numeric, emergency_services text[], emergency_radius_km integer)
language sql security definer set search_path = public as $$
  select id, name, coalesce(whatsapp, phone), latitude, longitude, emergency_services, emergency_radius_km
  from public.workshops
  where emergency_enabled = true and latitude is not null and longitude is not null;
$$;
grant execute on function public.get_active_sos_workshops() to anon, authenticated;
