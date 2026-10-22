-- Keep existing documents and their accepted totals unchanged. New discounts are saved explicitly.
alter table public.budgets add column pix_discount_percent numeric(5,2) not null default 0 check (pix_discount_percent between 0 and 100), add column deferred_without_deposit boolean not null default false;
alter table public.service_orders add column pix_discount_percent numeric(5,2) not null default 0 check (pix_discount_percent between 0 and 100), add column deferred_without_deposit boolean not null default false;
-- Preserve the earlier manually entered surcharge agreements, without changing their revisions.
update public.budgets set deferred_without_deposit=true where surcharge_percent>0;
update public.service_orders set deferred_without_deposit=true where surcharge_percent>0;
alter table public.budgets add constraint budget_payment_adjustments check ((surcharge_percent=0 or deferred_without_deposit) and (pix_discount_percent=0 or (payment_method='pix' and not deferred_without_deposit and surcharge_percent=0)));
alter table public.service_orders add constraint order_payment_adjustments check ((surcharge_percent=0 or deferred_without_deposit) and (pix_discount_percent=0 or (payment_method='pix' and not deferred_without_deposit and surcharge_percent=0)));
create or replace function public.invalidate_document_payment_revision() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if row(new.payment_method,new.payment_terms,new.surcharge_percent,new.surcharge_reason,new.pix_discount_percent,new.deferred_without_deposit,new.client_id,new.vehicle_id,new.owner_id)
     is distinct from row(old.payment_method,old.payment_terms,old.surcharge_percent,old.surcharge_reason,old.pix_discount_percent,old.deferred_without_deposit,old.client_id,old.vehicle_id,old.owner_id) then
    new.payment_revision=gen_random_uuid();
  end if;
  return new;
end;
$$;

create or replace function public.get_document_payment_terms(p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare doc record; subtotal numeric; fee numeric; discount_amount numeric; available_discount numeric; accepted jsonb; parent_table text; item_table text; parent_column text;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  if p_kind='budget' then parent_table='budgets'; item_table='budget_items'; parent_column='budget_id';
  elsif p_kind='order' then parent_table='service_orders'; item_table='service_order_items'; parent_column='service_order_id';
  else raise exception 'Documento inválido.'; end if;
  execute format('select workshop_id,owner_id,payment_method,payment_terms,surcharge_percent,surcharge_reason,pix_discount_percent,deferred_without_deposit,payment_revision from public.%I where id=$1',parent_table) into doc using p_id;
  if doc.workshop_id is null or not coalesce((public.is_workshop_member(doc.workshop_id) or doc.owner_id=auth.uid()),false) then raise exception 'Documento não encontrado.'; end if;
  execute format('select round(coalesce(sum(quantity*unit_price-discount),0),2) from public.%I where %I=$1',item_table,parent_column) into subtotal using p_id;
  fee=round(subtotal*doc.surcharge_percent/100,2);
  discount_amount=round(subtotal*doc.pix_discount_percent/100,2);
  select coalesce(pix_discount_percentage,0) into available_discount from public.workshops where id=doc.workshop_id;
  select jsonb_build_object('at',accepted_at,'source',source,'total',snapshot->'total') into accepted from public.payment_acceptance_events
   where document_kind=p_kind and document_id=p_id and document_revision=doc.payment_revision order by accepted_at desc limit 1;
  return jsonb_build_object('payment_method',doc.payment_method,'payment_terms',doc.payment_terms,'surcharge_percent',doc.surcharge_percent,'surcharge_reason',doc.surcharge_reason,'pix_discount_percent',doc.pix_discount_percent,'deferred_without_deposit',doc.deferred_without_deposit,'available_pix_discount_percent',available_discount,'pix_discount',discount_amount,'subtotal',subtotal,'total',subtotal+fee-discount_amount,'revision',doc.payment_revision,'acceptance',accepted);
end;
$$;

drop function public.save_document_payment_terms(text,uuid,text,text,numeric,uuid,text);
create function public.save_document_payment_terms(p_kind text,p_id uuid,p_method text,p_terms text,p_percent numeric,p_revision uuid,p_reason text default '',p_deferred boolean default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare doc record; parent_table text; deferred boolean; discount_rate numeric:=0;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  if p_kind='budget' then parent_table='budgets'; elsif p_kind='order' then parent_table='service_orders'; else raise exception 'Documento inválido.'; end if;
  execute format('select workshop_id,payment_revision from public.%I where id=$1 for update',parent_table) into doc using p_id;
  if doc.workshop_id is null or not coalesce(public.is_workshop_member(doc.workshop_id),false) then raise exception 'Acesso não autorizado.'; end if;
  if p_revision is distinct from doc.payment_revision then raise exception 'O documento mudou. Abra novamente antes de salvar.'; end if;
  if p_method is null or p_method not in ('not_defined','pix','cash','debit_card','credit_card','combined') or p_terms is null or length(p_terms)>2000 or p_percent is null or p_percent::text in ('NaN','Infinity','-Infinity') or p_percent<0 or p_percent>100 or round(p_percent,2)<>p_percent then raise exception 'Condições ou percentual inválidos.'; end if;
  if p_reason is null or length(p_reason)>500 or (p_percent>0 and length(trim(p_reason))=0) then raise exception 'Informe o motivo do acréscimo escolhido (até 500 caracteres).'; end if;
  deferred=coalesce(p_deferred,p_percent>0);
  if p_percent>0 and not deferred then raise exception 'O acréscimo é reservado à retirada sem entrada. Marque essa condição.'; end if;
  if p_method='pix' and not deferred and p_percent=0 then
    select coalesce(pix_discount_percentage,0) into discount_rate from public.workshops where id=doc.workshop_id;
  end if;
  execute format('update public.%I set payment_method=$2,payment_terms=$3,surcharge_percent=$4,surcharge_reason=$5,pix_discount_percent=$6,deferred_without_deposit=$7,updated_at=now() where id=$1',parent_table) using p_id,p_method,p_terms,p_percent,trim(p_reason),discount_rate,deferred;
  if p_kind='budget' then update public.budgets set status='draft',approved_at=null where id=p_id and status in ('sent','approved'); end if;
  return public.get_document_payment_terms(p_kind,p_id);
end;
$$;
revoke all on function public.save_document_payment_terms(text,uuid,text,text,numeric,uuid,text,boolean) from public,anon;
grant execute on function public.save_document_payment_terms(text,uuid,text,text,numeric,uuid,text,boolean) to authenticated;

