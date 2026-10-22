alter table public.budgets add column surcharge_reason text not null default '' check (length(surcharge_reason)<=500);
alter table public.service_orders add column surcharge_reason text not null default '' check (length(surcharge_reason)<=500);
alter table public.attachments add column attachment_kind text not null default 'general'
 check (attachment_kind in ('general','mileage_initial','mileage_final'));
create unique index order_mileage_photo_unique on public.attachments(service_order_id,attachment_kind) where attachment_kind in ('mileage_initial','mileage_final');
create index attachment_order_kind_idx on public.attachments(service_order_id,attachment_kind);
drop function public.save_document_payment_terms(text,uuid,text,text,numeric,uuid);
create or replace function public.invalidate_document_payment_revision() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if row(new.payment_method,new.payment_terms,new.surcharge_percent,new.surcharge_reason,new.client_id,new.vehicle_id,new.owner_id)
     is distinct from row(old.payment_method,old.payment_terms,old.surcharge_percent,old.surcharge_reason,old.client_id,old.vehicle_id,old.owner_id) then
    new.payment_revision=gen_random_uuid();
  end if;
  return new;
end;
$$;

create or replace function public.get_document_payment_terms(p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare doc record; subtotal numeric; fee numeric; accepted jsonb; parent_table text; item_table text; parent_column text;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  if p_kind='budget' then parent_table='budgets'; item_table='budget_items'; parent_column='budget_id';
  elsif p_kind='order' then parent_table='service_orders'; item_table='service_order_items'; parent_column='service_order_id';
  else raise exception 'Documento inválido.'; end if;
  execute format('select workshop_id,owner_id,payment_method,payment_terms,surcharge_percent,surcharge_reason,payment_revision from public.%I where id=$1',parent_table) into doc using p_id;
  if doc.workshop_id is null or not coalesce((public.is_workshop_member(doc.workshop_id) or doc.owner_id=auth.uid()),false) then raise exception 'Documento não encontrado.'; end if;
  execute format('select round(coalesce(sum(quantity*unit_price-discount),0),2) from public.%I where %I=$1',item_table,parent_column) into subtotal using p_id;
  fee=round(subtotal*doc.surcharge_percent/100,2);
  select jsonb_build_object('at',accepted_at,'source',source,'total',snapshot->'total') into accepted from public.payment_acceptance_events
   where document_kind=p_kind and document_id=p_id and document_revision=doc.payment_revision order by accepted_at desc limit 1;
  return jsonb_build_object('payment_method',doc.payment_method,'payment_terms',doc.payment_terms,'surcharge_percent',doc.surcharge_percent,'surcharge_reason',doc.surcharge_reason,'subtotal',subtotal,'total',subtotal+fee,'revision',doc.payment_revision,'acceptance',accepted);
end;
$$;

create or replace function public.save_document_payment_terms(p_kind text,p_id uuid,p_method text,p_terms text,p_percent numeric,p_revision uuid,p_reason text default '') returns jsonb language plpgsql security definer set search_path=public as $$
declare doc record; parent_table text;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  if p_kind='budget' then parent_table='budgets'; elsif p_kind='order' then parent_table='service_orders'; else raise exception 'Documento inválido.'; end if;
  execute format('select workshop_id,payment_revision from public.%I where id=$1 for update',parent_table) into doc using p_id;
  if doc.workshop_id is null or not coalesce(public.is_workshop_member(doc.workshop_id),false) then raise exception 'Acesso não autorizado.'; end if;
  if p_revision is distinct from doc.payment_revision then raise exception 'O documento mudou. Abra novamente antes de salvar.'; end if;
  if p_method is null or p_method not in ('not_defined','pix','cash','debit_card','credit_card','combined') or p_terms is null or length(p_terms)>2000 or p_percent is null or p_percent::text in ('NaN','Infinity','-Infinity') or p_percent<0 or p_percent>100 or round(p_percent,2)<>p_percent then raise exception 'Condições ou percentual inválidos.'; end if;
  if p_reason is null or length(p_reason)>500 or (p_percent>0 and length(trim(p_reason))=0) then raise exception 'Informe o motivo do acréscimo escolhido (até 500 caracteres).'; end if;
  execute format('update public.%I set payment_method=$2,payment_terms=$3,surcharge_percent=$4,surcharge_reason=$5,updated_at=now() where id=$1',parent_table) using p_id,p_method,p_terms,p_percent,trim(p_reason);
  if p_kind='budget' then update public.budgets set status='draft',approved_at=null where id=p_id and status in ('sent','approved'); end if;
  return public.get_document_payment_terms(p_kind,p_id);
end;
$$;
revoke all on function public.save_document_payment_terms(text,uuid,text,text,numeric,uuid,text) from public,anon;
grant execute on function public.save_document_payment_terms(text,uuid,text,text,numeric,uuid,text) to authenticated;

create function public.validate_order_mileage_attachment() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.attachment_kind in ('mileage_initial','mileage_final') then
    if new.service_order_id is null or not exists (select 1 from public.service_orders o where o.id=new.service_order_id and o.workshop_id=new.workshop_id) then raise exception 'A foto deve pertencer a uma O.S. desta oficina.'; end if;
    if new.mime_type not in ('image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif','image/gif') or new.size_bytes<=0 or new.size_bytes>26214400 then raise exception 'Envie uma foto válida de até 25 MB.'; end if;
    new.created_at=now();
    if new.storage_path not like new.workshop_id::text||'/orders/'||new.service_order_id::text||'/'||new.attachment_kind||'/%' then raise exception 'Caminho da foto inválido para esta O.S.'; end if;
  end if;
  return new;
end;
$$;
create trigger validate_mileage_attachment before insert or update on public.attachments for each row execute function public.validate_order_mileage_attachment();
revoke all on function public.validate_order_mileage_attachment() from public,anon;
create policy "customer reads own mileage photos" on public.attachments for select to authenticated using (
  attachment_kind in ('mileage_initial','mileage_final') and exists (select 1 from public.service_orders o where o.id=attachments.service_order_id and o.owner_id=auth.uid())
);
create policy "customer reads own mileage storage" on storage.objects for select to authenticated using (
  bucket_id='workshop-attachments' and exists (
    select 1 from public.attachments a join public.service_orders o on o.id=a.service_order_id
    where a.storage_path=storage.objects.name and a.attachment_kind in ('mileage_initial','mileage_final') and o.owner_id=auth.uid()
  )
);
