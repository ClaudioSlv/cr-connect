create table if not exists public.labor_price_catalog (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  category text not null default 'Mecânica geral',
  name text not null,
  minimum_price numeric(12,2) not null default 0 check (minimum_price >= 0),
  maximum_price numeric(12,2) not null default 0 check (maximum_price >= minimum_price),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workshop_id, name)
);
alter table public.labor_price_catalog enable row level security;
create policy workshop_access on public.labor_price_catalog for all using (public.is_workshop_member(workshop_id)) with check (public.is_workshop_member(workshop_id));

create table if not exists public.labor_time_rates (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  name text not null,
  hours numeric(6,2),
  price numeric(12,2) not null default 0 check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workshop_id, name)
);
alter table public.labor_time_rates enable row level security;
create policy workshop_access on public.labor_time_rates for all using (public.is_workshop_member(workshop_id)) with check (public.is_workshop_member(workshop_id));

create or replace function public.adjust_labor_prices(p_workshop_id uuid, p_percent numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_workshop_member(p_workshop_id) then raise exception 'Sem permissão para reajustar preços.'; end if;
  if p_percent < -100 or p_percent > 1000 then raise exception 'Percentual de reajuste inválido.'; end if;
  update public.labor_price_catalog set minimum_price = round(minimum_price * (1 + p_percent / 100), 2), maximum_price = round(maximum_price * (1 + p_percent / 100), 2), updated_at = now() where workshop_id = p_workshop_id;
  update public.labor_time_rates set price = round(price * (1 + p_percent / 100), 2), updated_at = now() where workshop_id = p_workshop_id;
end;
$$;

insert into public.labor_price_catalog(workshop_id, category, name, minimum_price, maximum_price)
select workshops.id, catalog.category, catalog.name, catalog.minimum_price, catalog.maximum_price
from public.workshops workshops
cross join (values
  ('Mecânica geral','Troca de óleo + filtros',80,100),
  ('Mecânica geral','Troca de correia dentada',250,350),
  ('Mecânica geral','Troca de embreagem',400,550),
  ('Mecânica geral','Troca de amortecedores (par)',280,380),
  ('Mecânica geral','Troca de junta homocinética',150,200),
  ('Mecânica geral','Troca de coxim de motor',180,250),
  ('Mecânica geral','Troca de junta tampa cabeçote',150,180),
  ('Mecânica geral','Troca de velas e cabos',90,130),
  ('Mecânica geral','Limpeza de bicos injetores',120,160),
  ('Mecânica geral','Ajuste de válvulas',280,380),
  ('Mecânica geral','Retirada de vazamento de óleo',100,200),
  ('Elétrica','Diagnóstico elétrico',80,120),
  ('Elétrica','Troca de motor de arranque',120,180),
  ('Elétrica','Troca de alternador',130,200),
  ('Elétrica','Localização de fuga de corrente',100,150),
  ('Elétrica','Reset / Calibração com scanner',70,100),
  ('Elétrica','Troca de sensores',80,150)
) as catalog(category,name,minimum_price,maximum_price)
on conflict(workshop_id,name) do nothing;

insert into public.labor_time_rates(workshop_id, name, hours, price)
select workshops.id, rate.name, rate.hours, rate.price
from public.workshops workshops
cross join (values
  ('1 Hora de mão de obra',1,90),
  ('Meio dia (4h)',4,380),
  ('Dia completo (8h)',8,700),
  ('Diagnóstico com scanner',null,70)
) as rate(name,hours,price)
on conflict(workshop_id,name) do nothing;
