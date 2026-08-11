create table public.vehicle_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.owner_vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.vehicle_owners(user_id) on delete cascade,
  plate text,
  brand text,
  model text not null,
  year integer,
  color text,
  created_at timestamptz not null default now()
);
alter table public.vehicle_owners enable row level security;
alter table public.owner_vehicles enable row level security;
create policy "owner manages own account" on public.vehicle_owners for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "owner manages own vehicles" on public.owner_vehicles for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create or replace function public.create_vehicle_owner(p_name text, p_phone text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.profiles set full_name=left(trim(p_name),120) where id=auth.uid();
  insert into public.vehicle_owners(user_id,phone) values(auth.uid(),nullif(left(trim(coalesce(p_phone,'')),30),'')) on conflict(user_id) do update set phone=excluded.phone,updated_at=now();
end;
$$;
grant execute on function public.create_vehicle_owner(text,text) to authenticated;
