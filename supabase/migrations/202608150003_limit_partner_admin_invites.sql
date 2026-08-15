-- Cada oficina pode ter seu proprietário e apenas um sócio administrador.
alter table public.team_invites
  add column if not exists accepted_by uuid references auth.users(id);

create or replace function public.limit_workshop_admins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_admins integer;
begin
  if new.role <> 'admin' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.role = 'admin' then
    return new;
  end if;

  select count(*) into existing_admins
  from public.workshop_users
  where workshop_id = new.workshop_id
    and role = 'admin'
    and user_id <> new.user_id;

  -- A primeira conta de uma oficina é sempre o seu proprietário.
  if existing_admins = 0 then
    return new;
  end if;

  if existing_admins >= 2 then
    raise exception 'Esta oficina já possui o proprietário e um sócio administrador.';
  end if;

  if not exists (
    select 1 from public.team_invites
    where workshop_id = new.workshop_id
      and role = 'admin'
      and accepted_by = new.user_id
      and accepted_at is not null
  ) then
    raise exception 'O segundo administrador só pode entrar pelo convite enviado pelo proprietário.';
  end if;

  return new;
end;
$$;

drop trigger if exists workshop_admin_limit on public.workshop_users;
create trigger workshop_admin_limit
before insert or update of role on public.workshop_users
for each row execute function public.limit_workshop_admins();

create or replace function public.limit_admin_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'admin' and exists (
    select 1 from public.team_invites
    where workshop_id = new.workshop_id
      and role = 'admin'
      and id <> new.id
  ) then
    raise exception 'Já existe um convite de sócio administrador para esta oficina.';
  end if;
  return new;
end;
$$;

drop trigger if exists workshop_admin_invite_limit on public.team_invites;
create trigger workshop_admin_invite_limit
before insert or update of role on public.team_invites
for each row execute function public.limit_admin_invites();

create or replace function public.claim_team_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.team_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and accepted_at is null;

  insert into public.workshop_users (workshop_id, user_id, role)
  select workshop_id, auth.uid(), role
  from public.team_invites
  where accepted_by = auth.uid()
    and accepted_at is not null
  on conflict (workshop_id, user_id) do nothing;

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

grant execute on function public.claim_team_invites() to authenticated;
