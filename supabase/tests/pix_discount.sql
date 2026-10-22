begin;
do $$
declare f record; staff uuid; doc_id uuid; kind text; details jsonb; rev uuid; blocked boolean;
begin
 select c.workshop_id,c.id as client_id,v.id as vehicle_id,l.user_id as customer into f from public.clients c join public.client_portal_links l on l.client_id=c.id join public.vehicles v on v.client_id=c.id where not exists(select 1 from public.workshop_users w where w.user_id=l.user_id and w.workshop_id=c.workshop_id) limit 1;
 assert f.client_id is not null,'Missing test fixture';
 select user_id into staff from public.workshop_users where workshop_id=f.workshop_id limit 1;
 foreach kind in array array['budget','order'] loop
  perform set_config('request.jwt.claim.sub',staff::text,true);
  update public.workshops set pix_discount_percentage=7 where workshops.id=f.workshop_id;
  if kind='budget' then
   insert into public.budgets(workshop_id,client_id,vehicle_id,status) values(f.workshop_id,f.client_id,f.vehicle_id,'draft') returning budgets.id into doc_id;
   insert into public.budget_items(workshop_id,budget_id,kind,description,quantity,unit_price,discount) values(f.workshop_id,doc_id,'service','Teste transacional Pix',1,700,0);
  else
   insert into public.service_orders(workshop_id,client_id,vehicle_id,status,customer_complaint) values(f.workshop_id,f.client_id,f.vehicle_id,'open','Teste transacional Pix') returning service_orders.id into doc_id;
   insert into public.service_order_items(workshop_id,service_order_id,kind,description,quantity,unit_price,discount) values(f.workshop_id,doc_id,'service','Teste Pix',1,700,0);
  end if;
  details=public.get_document_payment_terms(kind,doc_id);
  assert (details->>'total')::numeric=700,'Existing default unexpectedly discounted';
  details=public.save_document_payment_terms(kind,doc_id,'pix','Pix integral na entrega',0,(details->>'revision')::uuid,'',false);
  assert (details->>'total')::numeric=651 and (details->>'pix_discount')::numeric=49,'Pix should charge 651';
  rev=(details->>'revision')::uuid;
  blocked=false;
  begin perform public.accept_document_payment_terms(kind,doc_id,rev,700); exception when others then blocked=true; end;
  assert blocked,'Accepted wrong undiscounted amount';
  details=public.accept_document_payment_terms(kind,doc_id,rev,651);
  assert (details->'acceptance'->>'total')::numeric=651,'Wrong acceptance snapshot';
  update public.workshops set pix_discount_percentage=12 where workshops.id=f.workshop_id;
  details=public.get_document_payment_terms(kind,doc_id);
  assert (details->>'total')::numeric=651 and (details->>'revision')::uuid=rev and details->'acceptance'<>'null'::jsonb,'Settings silently changed approved terms';
  details=public.save_document_payment_terms(kind,doc_id,'pix','Pix integral na entrega',0,rev,'',false);
  assert (details->>'total')::numeric=616 and details->'acceptance'='null'::jsonb,'Explicit discount update did not invalidate acceptance';
  blocked=false;
  begin perform public.save_document_payment_terms(kind,doc_id,'combined','Pagamento posterior',14.3,(details->>'revision')::uuid,'Prazo',false); exception when others then blocked=true; end;
  assert blocked,'Surcharge allowed without deferred condition';
  details=public.save_document_payment_terms(kind,doc_id,'combined','Retirada sem entrada. Pagamento em 30 dias.',14.3,(details->>'revision')::uuid,'Pagamento após entrega',true);
  assert (details->>'total')::numeric=800.10 and (details->>'pix_discount_percent')::numeric=0,'Surcharge stacked with discount';
  details=public.save_document_payment_terms(kind,doc_id,'pix','Pagamento posterior via Pix',0,(details->>'revision')::uuid,'',true);
  assert (details->>'total')::numeric=700,'Deferred Pix received cash discount';
  details=public.save_document_payment_terms(kind,doc_id,'cash','Dinheiro na entrega',0,(details->>'revision')::uuid,'',false);
  assert (details->>'total')::numeric=700,'Cash received Pix discount';
  details=public.save_document_payment_terms(kind,doc_id,'combined','Legado',14.3,(details->>'revision')::uuid,'Pagamento posterior');
  assert (details->>'total')::numeric=800.10 and (details->>'deferred_without_deposit')::boolean,'Older client save is incompatible';
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  blocked=false;
  begin perform public.get_document_payment_terms(kind,doc_id); exception when others then blocked=true; end;
  assert blocked,'Third party read terms';
  blocked=false;
  begin perform public.save_document_payment_terms(kind,doc_id,'pix','Teste',0,(details->>'revision')::uuid,'',false); exception when others then blocked=true; end;
  assert blocked,'Third party changed terms';
  perform set_config('request.jwt.claim.sub',staff::text,true);
  update public.workshops set pix_discount_percentage=7 where workshops.id=f.workshop_id;
  details=public.save_document_payment_terms(kind,doc_id,'pix','Pix integral na entrega',0,(details->>'revision')::uuid,'',false);
  if kind='budget' then
   update public.budgets set status='sent' where budgets.id=doc_id;
   perform set_config('request.jwt.claim.sub',f.customer::text,true);
   perform public.respond_to_budget_with_payment(doc_id,true,true,(details->>'revision')::uuid,651);
   details=public.get_document_payment_terms(kind,doc_id);
   assert details->'acceptance'->>'source'='client_portal','Client approval not recorded';
   assert (details->'acceptance'->>'total')::numeric=651,'Client approved a different total';
  end if;
 end loop;
 assert not has_function_privilege('anon','public.save_document_payment_terms(text,uuid,text,text,numeric,uuid,text,boolean)','EXECUTE'),'Anonymous save permitted';
end;
$$;
rollback;
