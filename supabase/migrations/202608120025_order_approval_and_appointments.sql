create or replace function public.respond_to_service_order(p_order_id uuid, p_approved boolean, p_appointment_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare workshop uuid;
begin
  select workshop_id into workshop from public.service_orders where id=p_order_id and owner_id=auth.uid();
  if workshop is null then raise exception 'O.S. nao encontrada.'; end if;
  if p_approved then update public.service_orders set customer_approved_at=now(),appointment_requested_at=p_appointment_at,updated_at=now() where id=p_order_id; perform public.notify_workshop_members(workshop,'Cliente aprovou a O.S.','O cliente aprovou e enviou uma data para agendamento.'); else update public.service_orders set status='cancelled',updated_at=now() where id=p_order_id; perform public.notify_workshop_members(workshop,'Cliente recusou a O.S.','O cliente recusou o orcamento.'); end if;
end;
$$;
create or replace function public.confirm_service_appointment(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_id into owner from public.service_orders where id=p_order_id and public.is_workshop_member(workshop_id); if owner is null then raise exception 'O.S. nao encontrada.'; end if;
  update public.service_orders set appointment_confirmed_at=now(),updated_at=now() where id=p_order_id;
  insert into public.client_notifications(user_id,service_order_id,title,body) values(owner,p_order_id,'Agendamento confirmado','A oficina confirmou o agendamento da sua O.S.');
end;
$$;
