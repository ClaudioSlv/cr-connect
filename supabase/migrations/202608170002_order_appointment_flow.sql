create or replace function public.respond_to_budget(p_budget_id uuid, p_approved boolean)
returns void language plpgsql security definer set search_path = public as $$
declare budget_row public.budgets%rowtype;
begin
  select * into budget_row from public.budgets where id = p_budget_id and owner_id = auth.uid();
  if budget_row.id is null then raise exception 'Orçamento não encontrado.'; end if;
  if budget_row.status <> 'sent' then raise exception 'Este orçamento não está aguardando resposta.'; end if;

  update public.budgets
  set status = case when p_approved then 'approved' else 'rejected' end,
      approved_at = case when p_approved then now() else null end,
      updated_at = now()
  where id = p_budget_id;

  if p_approved then
    update public.service_orders
    set status = 'awaiting_appointment', customer_approved_at = now(), updated_at = now()
    where id = budget_row.service_order_id and status = 'awaiting_approval';
    perform public.notify_workshop_members(budget_row.workshop_id, 'Cliente aprovou o orçamento', 'Escolha ou confirme a data de agendamento para o atendimento.');
  else
    update public.service_orders set status = 'cancelled', updated_at = now()
    where id = budget_row.service_order_id and status = 'awaiting_approval';
    perform public.notify_workshop_members(budget_row.workshop_id, 'Cliente recusou o orçamento', 'O cliente recusou o orçamento enviado.');
  end if;
end;
$$;

create or replace function public.request_service_appointment(p_order_id uuid, p_appointment_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare workshop uuid;
begin
  select workshop_id into workshop from public.service_orders
  where id = p_order_id and owner_id = auth.uid() and status = 'awaiting_appointment';
  if workshop is null then raise exception 'Esta O.S. não está disponível para agendamento.'; end if;
  if p_appointment_at is null then raise exception 'Informe data e horário para o agendamento.'; end if;
  if p_appointment_at <= now() then raise exception 'Escolha uma data e um horário futuros.'; end if;

  update public.service_orders set appointment_requested_at = p_appointment_at, updated_at = now() where id = p_order_id;
  perform public.notify_workshop_members(workshop, 'Novo pedido de agendamento', 'O cliente aprovou o orçamento e informou uma data para levar o veículo.');
end;
$$;

create or replace function public.confirm_service_appointment(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_id into owner from public.service_orders
  where id = p_order_id and public.is_workshop_member(workshop_id) and status = 'awaiting_appointment' and appointment_requested_at is not null;
  if owner is null then raise exception 'Agendamento não encontrado ou ainda sem data solicitada.'; end if;

  update public.service_orders
  set appointment_confirmed_at = now(), status = 'appointment_confirmed', updated_at = now()
  where id = p_order_id;
  insert into public.client_notifications(user_id, service_order_id, title, body)
  values(owner, p_order_id, 'Agendamento confirmado', 'A oficina confirmou o dia e horário para receber seu veículo.');
end;
$$;

create or replace function public.notify_client_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare title_text text;
begin
  if new.owner_id is null or (tg_op='UPDATE' and new.status is not distinct from old.status) then return new; end if;
  title_text := case new.status
    when 'open' then 'O.S. aberta'
    when 'diagnosing' then 'Veículo em diagnóstico'
    when 'awaiting_approval' then 'Orçamento disponível'
    when 'awaiting_appointment' then 'Orçamento aprovado · agende a visita'
    when 'appointment_confirmed' then 'Agendamento confirmado'
    when 'awaiting_part' then 'Aguardando peça'
    when 'repairing' then 'Veículo em manutenção'
    when 'finished' then 'CARRO PRONTO PARA RETIRADA'
    when 'delivered' then 'Veículo entregue'
    when 'cancelled' then 'O.S. cancelada'
    else 'O.S. atualizada'
  end;
  insert into public.client_notifications(user_id,service_order_id,title,body)
  values(new.owner_id,new.id,title_text,'Sua Ordem de Serviço #' || new.number || ' foi atualizada pela oficina.');
  return new;
end;
$$;
