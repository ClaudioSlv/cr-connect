create or replace function public.create_workshop_with_owner(
  workshop_name text,
  country text default 'BR',
  currency text default 'BRL',
  workshop_timezone text default 'America/Sao_Paulo',
  workshop_phone text default null,
  workshop_whatsapp text default null
)
returns public.workshops
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workshop public.workshops;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(workshop_name, ''))) < 2 then raise exception 'Informe o nome da oficina.'; end if;

  insert into public.workshops (name, country_code, currency_code, timezone, phone, whatsapp)
  values (
    left(trim(workshop_name), 120), country, currency, workshop_timezone,
    nullif(left(trim(coalesce(workshop_phone, '')), 30), ''),
    nullif(left(trim(coalesce(workshop_whatsapp, '')), 30), '')
  )
  returning * into new_workshop;

  insert into public.workshop_users (workshop_id, user_id, role)
  values (new_workshop.id, auth.uid(), 'admin');
  return new_workshop;
end;
$$;

revoke all on function public.create_workshop_with_owner(text, text, text, text, text, text) from public;
grant execute on function public.create_workshop_with_owner(text, text, text, text, text, text) to authenticated;
