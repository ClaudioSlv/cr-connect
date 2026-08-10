-- Módulos operacionais do CR Connect. Todo dado é isolado por workshop_id.
create type public.service_order_status as enum ('open', 'diagnosing', 'awaiting_approval', 'awaiting_part', 'repairing', 'finished', 'delivered', 'cancelled');
create type public.item_kind as enum ('service', 'part', 'labor');
create type public.stock_movement_kind as enum ('in', 'out', 'adjustment');
create type public.budget_status as enum ('draft', 'sent', 'approved', 'rejected', 'expired');

create table public.clients (
  id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade,
  full_name text not null, document_number text, phone text, whatsapp text, email text, address jsonb not null default '{}'::jsonb,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workshop_id, document_number)
);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict, plate text, brand text not null, model text not null, version text,
  year_model smallint, fuel text, engine text, mileage integer, vin text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workshop_id, plate)
);
create table public.service_orders (
  id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade,
  number bigint generated always as identity, client_id uuid not null references public.clients(id) on delete restrict, vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  status public.service_order_status not null default 'open', opened_at timestamptz not null default now(), mileage integer,
  customer_complaint text not null, diagnosis text, notes text, customer_approved_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workshop_id, number)
);
create table public.service_order_items (
  id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade, kind public.item_kind not null, description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0), unit_price numeric(12,2) not null default 0 check (unit_price >= 0), discount numeric(12,2) not null default 0 check (discount >= 0), product_id uuid, created_at timestamptz not null default now()
);
create table public.budgets (
  id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade,
  service_order_id uuid references public.service_orders(id) on delete set null, client_id uuid not null references public.clients(id) on delete restrict, vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  status public.budget_status not null default 'draft', valid_until date, terms text, approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.budget_items (
  id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade, budget_id uuid not null references public.budgets(id) on delete cascade,
  kind public.item_kind not null, description text not null, quantity numeric(12,3) not null default 1 check (quantity > 0), unit_price numeric(12,2) not null default 0, discount numeric(12,2) not null default 0
);
create table public.products (
  id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade,
  code text, description text not null, manufacturer text, supplier text, cost_price numeric(12,2) not null default 0, sale_price numeric(12,2) not null default 0, quantity numeric(12,3) not null default 0, minimum_quantity numeric(12,3) not null default 0, location text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (workshop_id, code)
);
alter table public.service_order_items add constraint service_order_items_product_id_fkey foreign key (product_id) references public.products(id) on delete set null;
create table public.stock_movements (id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade, product_id uuid not null references public.products(id) on delete restrict, kind public.stock_movement_kind not null, quantity numeric(12,3) not null check (quantity > 0), reference_type text, reference_id uuid, notes text, created_at timestamptz not null default now());
create table public.attachments (id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade, service_order_id uuid references public.service_orders(id) on delete cascade, vehicle_id uuid references public.vehicles(id) on delete cascade, client_id uuid references public.clients(id) on delete cascade, storage_path text not null unique, file_name text not null, mime_type text not null, size_bytes bigint not null, created_at timestamptz not null default now());
create table public.dtcs (id uuid primary key default gen_random_uuid(), workshop_id uuid references public.workshops(id) on delete cascade, code text not null, title text not null, description text, possible_causes text, recommended_tests text, created_at timestamptz not null default now());
create table public.technical_data (id uuid primary key default gen_random_uuid(), workshop_id uuid references public.workshops(id) on delete cascade, brand text, model text, engine text, category text not null, title text not null, content text not null, source_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.messages (id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade, client_id uuid references public.clients(id) on delete set null, sender_id uuid not null references auth.users(id), body text not null, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, title text not null, body text, read_at timestamptz, created_at timestamptz not null default now());
create table public.subscriptions (id uuid primary key default gen_random_uuid(), workshop_id uuid not null unique references public.workshops(id) on delete cascade, plan_code text not null default 'free', status text not null default 'active', provider text, provider_reference text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

do $$ declare table_name text; begin
  foreach table_name in array array['clients','vehicles','service_orders','service_order_items','budgets','budget_items','products','stock_movements','attachments','messages','notifications','subscriptions'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy workshop_access on public.%I for all using (public.is_workshop_member(workshop_id)) with check (public.is_workshop_member(workshop_id))', table_name);
  end loop;
end $$;
alter table public.dtcs enable row level security;
alter table public.technical_data enable row level security;
create policy dtcs_access on public.dtcs for select using (workshop_id is null or public.is_workshop_member(workshop_id));
create policy technical_data_access on public.technical_data for select using (workshop_id is null or public.is_workshop_member(workshop_id));
