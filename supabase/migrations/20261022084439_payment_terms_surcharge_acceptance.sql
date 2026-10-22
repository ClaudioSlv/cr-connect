alter table public.budgets
  add column payment_method text not null default 'not_defined' check (payment_method in ('not_defined','pix','cash','debit_card','credit_card','combined')),
  add column payment_terms text not null default '' check (length(payment_terms)<=2000),
  add column surcharge_percent numeric(5,2) not null default 0 check (surcharge_percent>=0 and surcharge_percent<=100),
  add column payment_revision uuid not null default gen_random_uuid();
alter table public.service_orders
  add column payment_method text not null default 'not_defined' check (payment_method in ('not_defined','pix','cash','debit_card','credit_card','combined')),
  add column payment_terms text not null default '' check (length(payment_terms)<=2000),
  add column surcharge_percent numeric(5,2) not null default 0 check (surcharge_percent>=0 and surcharge_percent<=100),
  add column payment_revision uuid not null default gen_random_uuid();

create table public.payment_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  document_kind text not null check (document_kind in ('order','budget')),
  document_id uuid not null,
  workshop_id uuid not null references public.workshops(id),
  owner_id uuid,
  document_revision uuid not null,
  actor_id uuid not null,
  source text not null check (source in ('client_portal','workshop_record')),
  accepted_at timestamptz not null default now(),
  snapshot jsonb not null
);
alter table public.payment_acceptance_events enable row level security;
create index payment_acceptance_document_idx on public.payment_acceptance_events(document_kind,document_id,document_revision,accepted_at desc);
create index payment_acceptance_workshop_idx on public.payment_acceptance_events(workshop_id);
create policy "read payment acceptance records" on public.payment_acceptance_events for select to authenticated using (public.is_workshop_member(workshop_id) or owner_id=auth.uid());
revoke all on public.payment_acceptance_events from anon,authenticated;
grant select on public.payment_acceptance_events to authenticated;

create function public.invalidate_document_payment_revision() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if row(new.payment_method,new.payment_terms,new.surcharge_percent,new.client_id,new.vehicle_id,new.owner_id)
     is distinct from row(old.payment_method,old.payment_terms,old.surcharge_percent,old.client_id,old.vehicle_id,old.owner_id) then
    new.payment_revision=gen_random_uuid();
  end if;
  return new;
end;
$$;
create trigger payment_terms_revision before update on public.budgets for each row execute function public.invalidate_document_payment_revision();
create trigger payment_terms_revision before update on public.service_orders for each row execute function public.invalidate_document_payment_revision();

create function public.invalidate_item_payment_revision() returns trigger language plpgsql security invoker set search_path=public as $$
declare parent_table text; parent_column text; old_id uuid; new_id uuid;
begin
  if tg_table_name='budget_items' then parent_table='budgets'; parent_column='budget_id'; else parent_table='service_orders'; parent_column='service_order_id'; end if;
  if tg_op<>'INSERT' then old_id=(to_jsonb(old)->>parent_column)::uuid; end if;
  if tg_op<>'DELETE' then new_id=(to_jsonb(new)->>parent_column)::uuid; end if;
  -- Lock the parent before mutating items; acceptance locks the same row.
  execute format('update public.%I set payment_revision=gen_random_uuid() where id=$1 or id=$2',parent_table) using old_id,new_id;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger payment_items_revision before insert or update or delete on public.budget_items for each row execute function public.invalidate_item_payment_revision();
create trigger payment_items_revision before insert or update or delete on public.service_order_items for each row execute function public.invalidate_item_payment_revision();

create function public.get_document_payment_terms(p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare doc record; subtotal numeric; fee numeric; accepted jsonb; parent_table text; item_table text; parent_column text;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  if p_kind='budget' then parent_table='budgets'; item_table='budget_items'; parent_column='budget_id';
  elsif p_kind='order' then parent_table='service_orders'; item_table='service_order_items'; parent_column='service_order_id';
  else raise exception 'Documento inválido.'; end if;
  execute format('select workshop_id,owner_id,payment_method,payment_terms,surcharge_percent,payment_revision from public.%I where id=$1',parent_table) into doc using p_id;
  if doc.workshop_id is null or not coalesce((public.is_workshop_member(doc.workshop_id) or doc.owner_id=auth.uid()),false) then raise exception 'Documento não encontrado.'; end if;
  execute format('select round(coalesce(sum(quantity*unit_price-discount),0),2) from public.%I where %I=$1',item_table,parent_column) into subtotal using p_id;
  fee=round(subtotal*doc.surcharge_percent/100,2);
  select jsonb_build_object('at',accepted_at,'source',source,'total',snapshot->'total') into accepted from public.payment_acceptance_events
   where document_kind=p_kind and document_id=p_id and document_revision=doc.payment_revision order by accepted_at desc limit 1;
  return jsonb_build_object('payment_method',doc.payment_method,'payment_terms',doc.payment_terms,'surcharge_percent',doc.surcharge_percent,'subtotal',subtotal,'total',subtotal+fee,'revision',doc.payment_revision,'acceptance',accepted);
end;
$$;

create function public.save_document_payment_terms(p_kind text,p_id uuid,p_method text,p_terms text,p_percent numeric,p_revision uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare doc record; parent_table text;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  if p_kind='budget' then parent_table='budgets'; elsif p_kind='order' then parent_table='service_orders'; else raise exception 'Documento inválido.'; end if;
  execute format('select workshop_id,payment_revision from public.%I where id=$1 for update',parent_table) into doc using p_id;
  if doc.workshop_id is null or not coalesce(public.is_workshop_member(doc.workshop_id),false) then raise exception 'Acesso não autorizado.'; end if;
  if p_revision is distinct from doc.payment_revision then raise exception 'O documento mudou. Abra novamente antes de salvar.'; end if;
  if p_method is null or p_method not in ('not_defined','pix','cash','debit_card','credit_card','combined') or p_terms is null or length(p_terms)>2000 or p_percent is null or p_percent::text in ('NaN','Infinity','-Infinity') or p_percent<0 or p_percent>100 or round(p_percent,2)<>p_percent then raise exception 'Condições ou percentual inválidos.'; end if;
  execute format('update public.%I set payment_method=$2,payment_terms=$3,surcharge_percent=$4,updated_at=now() where id=$1',parent_table) using p_id,p_method,p_terms,p_percent;
  if p_kind='budget' then update public.budgets set status='draft',approved_at=null where id=p_id and status in ('sent','approved'); end if;
  return public.get_document_payment_terms(p_kind,p_id);
end;
$$;

create function public.accept_document_payment_terms(p_kind text,p_id uuid,p_revision uuid,p_total numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare doc record; current_terms jsonb; parent_table text; event_source text;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  if p_kind='budget' then parent_table='budgets'; elsif p_kind='order' then parent_table='service_orders'; else raise exception 'Documento inválido.'; end if;
  execute format('select workshop_id,owner_id,payment_revision,status::text as status,client_id,vehicle_id from public.%I where id=$1 for update',parent_table) into doc using p_id;
  if doc.workshop_id is null then raise exception 'Documento não encontrado.'; end if;
  if public.is_workshop_member(doc.workshop_id) then event_source='workshop_record';
  elsif doc.owner_id=auth.uid() then
    if p_kind='budget' and doc.status<>'sent' then raise exception 'Este orçamento não está aguardando aprovação.'; end if;
    event_source='client_portal';
  else raise exception 'Acesso não autorizado.'; end if;
  current_terms=public.get_document_payment_terms(p_kind,p_id);
  if p_revision is distinct from doc.payment_revision or p_total is distinct from (current_terms->>'total')::numeric then raise exception 'Os valores ou condições mudaram. Atualize e confira antes de aceitar.'; end if;
  if current_terms->>'payment_method'='not_defined' or length(trim(current_terms->>'payment_terms'))=0 or p_total<=0 then raise exception 'Defina a forma de pagamento, as condições e os itens antes do aceite.'; end if;
  insert into public.payment_acceptance_events(document_kind,document_id,workshop_id,owner_id,document_revision,actor_id,source,snapshot)
    values(p_kind,p_id,doc.workshop_id,doc.owner_id,doc.payment_revision,auth.uid(),event_source,current_terms||jsonb_build_object('client_id',doc.client_id,'vehicle_id',doc.vehicle_id));
  return public.get_document_payment_terms(p_kind,p_id);
end;
$$;

create function public.respond_to_budget_with_payment(p_budget_id uuid,p_approved boolean,p_terms_accepted boolean,p_revision uuid,p_total numeric) returns void language plpgsql security definer set search_path=public as $$
declare doc public.budgets%rowtype;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  select * into doc from public.budgets where id=p_budget_id and owner_id=auth.uid() for update;
  if doc.id is null or doc.status<>'sent' then raise exception 'Orçamento não encontrado ou já respondido.'; end if;
  if p_approved then
    if not coalesce(p_terms_accepted,false) then raise exception 'Confirme o aceite das condições de pagamento.'; end if;
    perform public.accept_document_payment_terms('budget',p_budget_id,p_revision,p_total);
  end if;
  perform public.respond_to_budget(p_budget_id,p_approved);
end;
$$;

-- Existing approval endpoint also requires a current acceptance for configured terms.
create or replace function public.respond_to_budget(p_budget_id uuid,p_approved boolean) returns void language plpgsql security definer set search_path=public as $$
declare budget_row public.budgets%rowtype;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  select * into budget_row from public.budgets where id=p_budget_id and owner_id=auth.uid() for update;
  if budget_row.id is null then raise exception 'Orçamento não encontrado.'; end if;
  if budget_row.status<>'sent' then raise exception 'Este orçamento não está aguardando resposta.'; end if;
  if p_approved and (budget_row.payment_method<>'not_defined' or budget_row.surcharge_percent>0 or budget_row.payment_terms<>'') and not exists (
    select 1 from public.payment_acceptance_events where document_kind='budget' and document_id=p_budget_id and document_revision=budget_row.payment_revision and actor_id=auth.uid() and source='client_portal'
  ) then raise exception 'Confira e aceite as condições de pagamento antes de aprovar.'; end if;
  update public.budgets set status=case when p_approved then 'approved'::public.budget_status else 'rejected'::public.budget_status end,approved_at=case when p_approved then now() else null end,updated_at=now() where id=p_budget_id;
  if p_approved then
    perform public.notify_workshop_members(budget_row.workshop_id,'Cliente aprovou o orçamento','O cliente aprovou o orçamento e as condições de pagamento.');
    update public.service_orders set status='repairing',customer_approved_at=now(),updated_at=now() where id=budget_row.service_order_id and status='awaiting_approval';
  else
    perform public.notify_workshop_members(budget_row.workshop_id,'Cliente recusou o orçamento','O cliente recusou o orçamento enviado.');
    update public.service_orders set status='cancelled',updated_at=now() where id=budget_row.service_order_id and status='awaiting_approval';
  end if;
end;
$$;

revoke all on function public.get_document_payment_terms(text,uuid),public.save_document_payment_terms(text,uuid,text,text,numeric,uuid),public.accept_document_payment_terms(text,uuid,uuid,numeric),public.respond_to_budget_with_payment(uuid,boolean,boolean,uuid,numeric),public.respond_to_budget(uuid,boolean),public.invalidate_document_payment_revision(),public.invalidate_item_payment_revision() from public,anon;
grant execute on function public.get_document_payment_terms(text,uuid),public.save_document_payment_terms(text,uuid,text,text,numeric,uuid),public.accept_document_payment_terms(text,uuid,uuid,numeric),public.respond_to_budget_with_payment(uuid,boolean,boolean,uuid,numeric),public.respond_to_budget(uuid,boolean) to authenticated;

create function public.require_payment_acceptance_for_repair() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status='repairing' and old.status is distinct from new.status and
    (new.payment_method<>'not_defined' or new.payment_terms<>'' or new.surcharge_percent>0) and not exists (
      select 1 from public.payment_acceptance_events where document_kind='order' and document_id=new.id and document_revision=new.payment_revision
    ) then raise exception 'Registre o aceite das condições de pagamento antes de iniciar o reparo.'; end if;
  return new;
end;
$$;
create trigger require_payment_acceptance before update of status on public.service_orders for each row execute function public.require_payment_acceptance_for_repair();
revoke all on function public.require_payment_acceptance_for_repair() from public,anon;
