create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  token text not null unique,
  checkout_url text not null,
  client_name text not null,
  budget_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

alter table public.payment_links enable row level security;

drop policy if exists "admins manage payment links" on public.payment_links;
create policy "admins manage payment links" on public.payment_links
  for all to authenticated
  using (exists (select 1 from public.workshop_users wu where wu.workshop_id = payment_links.workshop_id and wu.user_id = auth.uid() and wu.role = 'admin'))
  with check (exists (select 1 from public.workshop_users wu where wu.workshop_id = payment_links.workshop_id and wu.user_id = auth.uid() and wu.role = 'admin'));

create or replace function public.get_public_payment_link(p_token text)
returns table (client_name text, budget_number text, amount numeric, checkout_url text)
language sql
security definer
set search_path = public
as $$
  select p.client_name, p.budget_number, p.amount, p.checkout_url
  from public.payment_links p
  where p.token = p_token and p.expires_at > now()
  limit 1;
$$;

grant execute on function public.get_public_payment_link(text) to anon, authenticated;
