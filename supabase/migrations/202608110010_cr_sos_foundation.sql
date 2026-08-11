alter table public.workshops
  add column if not exists emergency_enabled boolean not null default false,
  add column if not exists emergency_services text[] not null default '{}',
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists emergency_radius_km integer not null default 10;

create type public.sos_status as enum ('requested', 'accepted', 'declined', 'cancelled', 'completed');
create table public.sos_requests (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references public.workshops(id) on delete set null,
  requester_name text not null,
  requester_phone text,
  service_type text not null,
  description text,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  status public.sos_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sos_requests enable row level security;
create policy "workshop manages own sos" on public.sos_requests for all using (workshop_id is not null and public.is_workshop_member(workshop_id)) with check (workshop_id is not null and public.is_workshop_member(workshop_id));
