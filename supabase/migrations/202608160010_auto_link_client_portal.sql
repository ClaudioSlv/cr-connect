-- Liga automaticamente o cadastro feito pela oficina à conta do proprietário
-- quando os dois usam o mesmo e-mail.
create or replace function public.link_client_portal_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $link$
declare owner_user_id uuid;
begin
  if nullif(trim(coalesce(new.email, '')), '') is null then
    return new;
  end if;

  select id into owner_user_id
  from auth.users
  where lower(email) = lower(trim(new.email))
    and email_confirmed_at is not null
  limit 1;

  if owner_user_id is not null then
    insert into public.client_portal_links(client_id, user_id)
    values (new.id, owner_user_id)
    on conflict (client_id) do update set user_id = excluded.user_id;
  end if;
  return new;
end;
$link$;

drop trigger if exists on_client_portal_email_link on public.clients;
create trigger on_client_portal_email_link
after insert or update of email on public.clients
for each row execute function public.link_client_portal_by_email();
