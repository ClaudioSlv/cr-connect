begin;
create temporary table mileage_fixture as
select c.workshop_id,c.id as client_id,v.id as vehicle_id,l.user_id as customer,
 (select user_id from public.workshop_users where workshop_id=c.workshop_id limit 1) as staff,
 gen_random_uuid() as order_id
from public.clients c join public.client_portal_links l on l.client_id=c.id join public.vehicles v on v.client_id=c.id
where not exists(select 1 from public.workshop_users w where w.user_id=l.user_id and w.workshop_id=c.workshop_id) limit 1;
grant select on mileage_fixture to authenticated;
do $$
declare f record; path text; rejected boolean; details jsonb;
begin
 select * into f from mileage_fixture;assert f.staff is not null,'Missing test fixture';
 perform set_config('request.jwt.claim.sub',f.staff::text,true);
 insert into public.service_orders(id,workshop_id,client_id,vehicle_id,owner_id,status,customer_complaint) values(f.order_id,f.workshop_id,f.client_id,f.vehicle_id,f.customer,'open','Teste transacional de fotos');
 details=public.get_document_payment_terms('order',f.order_id);
 assert (details->>'surcharge_percent')::numeric=0,'Acréscimo automático aplicado';
 assert details->>'surcharge_reason'='','Motivo preenchido automaticamente';
 rejected=false;
 begin perform public.save_document_payment_terms('order',f.order_id,'cash','Pagamento na entrega',14.3,(details->>'revision')::uuid,'');exception when others then rejected=true;end;
 assert rejected,'Taxa sem motivo aceita';
 details=public.save_document_payment_terms('order',f.order_id,'cash','Pagamento na entrega',14.3,(details->>'revision')::uuid,'Motivo escolhido pela oficina');
 assert details->>'surcharge_reason'='Motivo escolhido pela oficina','Motivo não salvo';
 path=f.workshop_id::text||'/orders/'||f.order_id::text||'/mileage_initial/test.jpg';
 insert into public.attachments(workshop_id,service_order_id,attachment_kind,storage_path,file_name,mime_type,size_bytes,created_at)
 values(f.workshop_id,f.order_id,'mileage_initial',path,'entrada.jpg','image/jpeg',100,'2000-01-01');
 insert into storage.objects(bucket_id,name) values('workshop-attachments',path);
 assert (select created_at>=transaction_timestamp() from public.attachments where storage_path=path),'Timestamp não é do servidor';
 rejected=false;
 begin insert into public.attachments(workshop_id,service_order_id,attachment_kind,storage_path,file_name,mime_type,size_bytes) values(f.workshop_id,f.order_id,'mileage_initial',path||'duplicate','outra.jpg','image/jpeg',100);exception when unique_violation then rejected=true;end;
 assert rejected,'Duas fotos iniciais permitidas';
 rejected=false;
 begin insert into public.attachments(workshop_id,service_order_id,attachment_kind,storage_path,file_name,mime_type,size_bytes) values(f.workshop_id,f.order_id,'mileage_final',replace(path,'mileage_initial','mileage_final'),'arquivo.pdf','application/pdf',100);exception when others then rejected=true;end;
 assert rejected,'Arquivo não imagem permitido';
 path=replace(path,'mileage_initial','mileage_final');
 insert into public.attachments(workshop_id,service_order_id,attachment_kind,storage_path,file_name,mime_type,size_bytes) values(f.workshop_id,f.order_id,'mileage_final',path,'saida.jpg','image/jpeg',100);
 insert into storage.objects(bucket_id,name) values('workshop-attachments',path);
 path=f.workshop_id::text||'/orders/'||f.order_id::text||'/general-test.pdf';
 insert into public.attachments(workshop_id,service_order_id,storage_path,file_name,mime_type,size_bytes) values(f.workshop_id,f.order_id,path,'interno.pdf','application/pdf',100);
 insert into storage.objects(bucket_id,name) values('workshop-attachments',path);
end;
$$;
select set_config('request.jwt.claim.sub',(select customer::text from mileage_fixture),true);
set local role authenticated;
do $$
declare n integer;
begin
 select count(*) into n from public.attachments where service_order_id=(select order_id from mileage_fixture);
 assert n=2,'Cliente não vê somente suas duas fotos';
 select count(*) into n from storage.objects where name like (select workshop_id::text||'/orders/'||order_id::text||'/%' from mileage_fixture);
 assert n=2,'Cliente conseguiu ler arquivo interno ou perdeu acesso às fotos';
end;
$$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$
declare n integer;
begin
 select count(*) into n from public.attachments where service_order_id=(select order_id from mileage_fixture);
 assert n=0,'Outro cliente conseguiu ler as fotos';
 select count(*) into n from storage.objects where name like (select workshop_id::text||'/orders/'||order_id::text||'/%' from mileage_fixture);
 assert n=0,'Outro cliente conseguiu ler os arquivos';
end;
$$;
reset role;
rollback;
