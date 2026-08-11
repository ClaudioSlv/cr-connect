create type public.financial_kind as enum ('income', 'expense');
create type public.financial_status as enum ('pending', 'paid', 'cancelled');

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  service_order_id uuid references public.service_orders(id) on delete set null,
  budget_id uuid references public.budgets(id) on delete set null,
  kind public.financial_kind not null,
  status public.financial_status not null default 'pending',
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.financial_transactions enable row level security;
create policy "workshop financial access" on public.financial_transactions for all
using (public.is_workshop_member(workshop_id)) with check (public.is_workshop_member(workshop_id));
