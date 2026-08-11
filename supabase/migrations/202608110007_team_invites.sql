create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  email text not null,
  role public.workshop_role not null default 'mechanic',
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workshop_id, email)
);
alter table public.team_invites enable row level security;

create or replace function public.is_workshop_admin(target_workshop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workshop_users where workshop_id = target_workshop_id and user_id = auth.uid() and role = 'admin');
$$;

create policy "admins manage members" on public.workshop_users for update
using (public.is_workshop_admin(workshop_id)) with check (public.is_workshop_admin(workshop_id));
create policy "admins manage invites" on public.team_invites for all
using (public.is_workshop_admin(workshop_id)) with check (public.is_workshop_admin(workshop_id));
create policy "members read colleague profiles" on public.profiles for select
using (exists (select 1 from public.workshop_users wu where wu.user_id = profiles.id and public.is_workshop_member(wu.workshop_id)));

create or replace function public.claim_team_invites()
returns integer language plpgsql security definer set search_path = public as $$
declare claimed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.workshop_users (workshop_id, user_id, role)
  select workshop_id, auth.uid(), role from public.team_invites
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and accepted_at is null
  on conflict (workshop_id, user_id) do nothing;
  get diagnostics claimed = row_count;
  update public.team_invites set accepted_at = now()
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and accepted_at is null;
  return claimed;
end;
$$;
grant execute on function public.claim_team_invites() to authenticated;
