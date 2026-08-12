alter table public.service_orders add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.service_orders add column if not exists appointment_requested_at timestamptz;
alter table public.service_orders add column if not exists appointment_confirmed_at timestamptz;

create table if not exists public.client_portal_links (
  client_id uuid primary key references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade, vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade, complaint text not null,
  status text not null default 'requested' check (status in ('requested','converted','declined')),
  service_order_id uuid references public.service_orders(id) on delete set null, created_at timestamptz not null default now(), responded_at timestamptz
);
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  service_order_id uuid references public.service_orders(id) on delete cascade, title text not null, body text, read_at timestamptz, created_at timestamptz not null default now()
);
alter table public.client_portal_links enable row level security;
alter table public.service_requests enable row level security;
alter table public.client_notifications enable row level security;
create policy "owner reads own client links" on public.client_portal_links for select using (user_id = auth.uid());
create policy "owner reads own requests" on public.service_requests for select using (owner_id = auth.uid());
create policy "workshop manages requests" on public.service_requests for all using (public.is_workshop_member(workshop_id)) with check (public.is_workshop_member(workshop_id));
create policy "owner reads client notifications" on public.client_notifications for select using (user_id = auth.uid());
create policy "owner updates client notifications" on public.client_notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner reads linked vehicles" on public.vehicles for select using (exists (select 1 from public.client_portal_links link where link.client_id = vehicles.client_id and link.user_id = auth.uid()));
create policy "owner reads own service orders" on public.service_orders for select using (owner_id = auth.uid());

create or replace function public.claim_client_portal_links()
returns void language plpgsql security definer set search_path = public as $$
declare user_email text;
begin
  if auth.uid() is null then return; end if;
  select lower(email) into user_email from auth.users where id = auth.uid();
  if user_email is null then return; end if;
  insert into public.client_portal_links(client_id, user_id)
  select id, auth.uid() from public.clients where lower(coalesce(email, '')) = user_email
  on conflict (client_id) do update set user_id = excluded.user_id;
end;
$$;

create or replace function public.create_client_service_request(p_client_id uuid, p_vehicle_id uuid, p_complaint text)
returns uuid language plpgsql security definer set search_path = public as $$
declare request_id uuid; workshop uuid;
begin
  select client.workshop_id into workshop from public.clients client join public.client_portal_links link on link.client_id = client.id where client.id = p_client_id and link.user_id = auth.uid();
  if workshop is null then raise exception 'Cliente não vinculado à sua conta.'; end if;
  insert into public.service_requests(workshop_id,client_id,vehicle_id,owner_id,complaint) values(workshop,p_client_id,p_vehicle_id,auth.uid(),trim(p_complaint)) returning id into request_id;
  perform public.notify_workshop_members(workshop, 'Nova solicitação de O.S.', 'Um cliente abriu uma solicitação de atendimento.');
  return request_id;
end;
$$;

create or replace function public.accept_client_service_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare request_row public.service_requests; order_id uuid;
begin
  select * into request_row from public.service_requests where id = p_request_id for update;
  if request_row.id is null or not public.is_workshop_member(request_row.workshop_id) then raise exception 'Solicitação não encontrada.'; end if;
  insert into public.service_orders(workshop_id,client_id,vehicle_id,owner_id,status,customer_complaint) values(request_row.workshop_id,request_row.client_id,request_row.vehicle_id,request_row.owner_id,'open',request_row.complaint) returning id into order_id;
  update public.service_requests set status='converted', service_order_id=order_id, responded_at=now() where id=p_request_id;
  insert into public.client_notifications(user_id,service_order_id,title,body) values(request_row.owner_id,order_id,'Solicitação de O.S. aceita','A oficina aceitou sua solicitação e abriu a Ordem de Serviço.');
  return order_id;
end;

create or replace function public.notify_client_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare title_text text;
begin
  if new.owner_id is null or (tg_op='UPDATE' and new.status is not distinct from old.status) then return new; end if;
  title_text := case new.status when 'open' then 'O.S. aberta' when 'diagnosing' then 'Veículo em diagnóstico' when 'awaiting_approval' then 'Orçamento disponível' when 'awaiting_part' then 'Aguardando peça' when 'repairing' then 'Veículo em reparo' when 'finished' then 'CARRO PRONTO PARA RETIRADA' when 'delivered' then 'Veículo entregue' when 'cancelled' then 'O.S. cancelada' else 'O.S. atualizada' end;
  insert into public.client_notifications(user_id,service_order_id,title,body) values(new.owner_id,new.id,title_text,'Sua Ordem de Serviço #' || new.number || ' foi atualizada pela oficina.');
  return new;
end;
$$;
drop trigger if exists on_client_order_status_notification on public.service_orders;
create trigger on_client_order_status_notification after insert or update of status on public.service_orders for each row execute function public.notify_client_order_status();
