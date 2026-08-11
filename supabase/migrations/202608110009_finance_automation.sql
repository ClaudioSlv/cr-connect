alter table public.financial_transactions add column if not exists source_reference text unique;

create or replace function public.sync_budget_finance()
returns trigger language plpgsql security definer set search_path = public as $$
declare total_value numeric(12,2);
begin
  if new.status <> 'approved' then return new; end if;
  select coalesce(sum(quantity * unit_price - discount), 0) into total_value from public.budget_items where budget_id = new.id;
  if total_value > 0 then
    insert into public.financial_transactions (workshop_id, budget_id, kind, status, category, description, amount, source_reference)
    values (new.workshop_id, new.id, 'income', 'pending', 'Orçamento', 'Recebimento do orçamento aprovado', total_value, 'budget:' || new.id::text)
    on conflict (source_reference) do update set amount = excluded.amount, updated_at = now()
    where public.financial_transactions.status = 'pending';
  end if;
  return new;
end;
$$;

create or replace function public.sync_order_finance()
returns trigger language plpgsql security definer set search_path = public as $$
declare total_value numeric(12,2);
begin
  if new.status <> 'delivered' then return new; end if;
  if exists (select 1 from public.budgets where service_order_id = new.id and status = 'approved') then return new; end if;
  select coalesce(sum(quantity * unit_price - discount), 0) into total_value from public.service_order_items where service_order_id = new.id;
  if total_value > 0 then
    insert into public.financial_transactions (workshop_id, service_order_id, kind, status, category, description, amount, source_reference)
    values (new.workshop_id, new.id, 'income', 'pending', 'Ordem de Serviço', 'Recebimento da O.S. #' || new.number, total_value, 'order:' || new.id::text)
    on conflict (source_reference) do update set amount = excluded.amount, updated_at = now()
    where public.financial_transactions.status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_approved_budget_finance on public.budgets;
create trigger on_approved_budget_finance after insert or update of status on public.budgets for each row execute function public.sync_budget_finance();
drop trigger if exists on_delivered_order_finance on public.service_orders;
create trigger on_delivered_order_finance after insert or update of status on public.service_orders for each row execute function public.sync_order_finance();
