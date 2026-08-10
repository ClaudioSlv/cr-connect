-- CR Connect: identidade, oficinas e isolamento multi-tenant.
create extension if not exists pgcrypto;
create type public.workshop_role as enum ('admin', 'mechanic', 'attendant', 'inventory');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  country_code text not null default 'BR' check (char_length(country_code) = 2),
  currency_code text not null default 'BRL' check (char_length(currency_code) = 3),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.workshop_users (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workshop_role not null default 'mechanic',
  created_at timestamptz not null default now(),
  primary key (workshop_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.workshops enable row level security;
alter table public.workshop_users enable row level security;

create function public.is_workshop_member(target_workshop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workshop_users where workshop_id = target_workshop_id and user_id = auth.uid());
$$;
create policy "profile owner can read profile" on public.profiles for select using (id = auth.uid());
create policy "profile owner can update profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "members can read workshop" on public.workshops for select using (public.is_workshop_member(id));
create policy "members can read workshop members" on public.workshop_users for select using (public.is_workshop_member(workshop_id));

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Cria uma oficina e vincula o usuário autenticado como administrador.
create function public.create_workshop_with_owner(workshop_name text, country text default 'BR', currency text default 'BRL', workshop_timezone text default 'America/Sao_Paulo')
returns public.workshops language plpgsql security definer set search_path = public as $$
declare new_workshop public.workshops;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.workshops (name, country_code, currency_code, timezone) values (workshop_name, country, currency, workshop_timezone) returning * into new_workshop;
  insert into public.workshop_users (workshop_id, user_id, role) values (new_workshop.id, auth.uid(), 'admin');
  return new_workshop;
end;
$$;
revoke all on function public.create_workshop_with_owner(text, text, text, text) from public;
grant execute on function public.create_workshop_with_owner(text, text, text, text) to authenticated;
