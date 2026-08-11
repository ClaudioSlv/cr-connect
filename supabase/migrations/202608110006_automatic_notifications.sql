create or replace function public.notify_workshop_members(p_workshop_id uuid, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (workshop_id, user_id, title, body)
  select p_workshop_id, user_id, p_title, p_body
  from public.workshop_users where workshop_id = p_workshop_id;
$$;

create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    perform public.notify_workshop_members(new.workshop_id, 'O.S. #' || new.number || ' atualizada', 'Novo status: ' || replace(new.status::text, '_', ' '));
  end if;
  return new;
end;
$$;

create or replace function public.notify_budget_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    perform public.notify_workshop_members(new.workshop_id, 'Orçamento atualizado', 'Novo status: ' || replace(new.status::text, '_', ' '));
  end if;
  return new;
end;
$$;

create or replace function public.notify_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.quantity <= new.minimum_quantity and (tg_op = 'INSERT' or old.quantity > old.minimum_quantity) then
    perform public.notify_workshop_members(new.workshop_id, 'Estoque baixo', new.description || ' atingiu o nível mínimo.');
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_status_notification on public.service_orders;
create trigger on_order_status_notification after insert or update of status on public.service_orders for each row execute function public.notify_order_status_change();
drop trigger if exists on_budget_status_notification on public.budgets;
create trigger on_budget_status_notification after insert or update of status on public.budgets for each row execute function public.notify_budget_status_change();
drop trigger if exists on_low_stock_notification on public.products;
create trigger on_low_stock_notification after insert or update of quantity, minimum_quantity on public.products for each row execute function public.notify_low_stock();
