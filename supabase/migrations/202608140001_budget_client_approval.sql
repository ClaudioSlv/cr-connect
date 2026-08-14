-- Aprovação de orçamento pelo proprietário do veículo.
alter table public.budgets add column if not exists owner_id uuid references auth.users(id) on delete set null;

update public.budgets budget
set owner_id = link.user_id
from public.client_portal_links link
where budget.client_id = link.client_id and budget.owner_id is null;

create or replace function public.assign_budget_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is null then
    select user_id into new.owner_id from public.client_portal_links where client_id = new.client_id;
  end if;
  return new;
end;
$$;
drop trigger if exists on_assign_budget_owner on public.budgets;
create trigger on_assign_budget_owner before insert or update of client_id on public.budgets for each row execute function public.assign_budget_owner();

create policy "owner reads own budgets" on public.budgets for select using (owner_id = auth.uid());
create policy "owner reads own budget items" on public.budget_items for select using (exists (select 1 from public.budgets budget where budget.id = budget_items.budget_id and budget.owner_id = auth.uid()));

create or replace function public.respond_to_budget(p_budget_id uuid, p_approved boolean)
returns void language plpgsql security definer set search_path = public as $$
declare budget_row public.budgets%rowtype;
begin
  select * into budget_row from public.budgets where id = p_budget_id and owner_id = auth.uid();
  if budget_row.id is null then raise exception 'Orçamento não encontrado.'; end if;
  if budget_row.status <> 'sent' then raise exception 'Este orçamento não está aguardando resposta.'; end if;
  update public.budgets set status = case when p_approved then 'approved' else 'rejected' end, approved_at = case when p_approved then now() else null end, updated_at = now() where id = p_budget_id;
  if p_approved then
    perform public.notify_workshop_members(budget_row.workshop_id, 'Cliente aprovou o orçamento', 'O cliente aprovou o orçamento e a oficina pode seguir com o atendimento.');
    update public.service_orders set status = 'repairing', customer_approved_at = now(), updated_at = now() where id = budget_row.service_order_id and status = 'awaiting_approval';
  else
    perform public.notify_workshop_members(budget_row.workshop_id, 'Cliente recusou o orçamento', 'O cliente recusou o orçamento enviado.');
    update public.service_orders set status = 'cancelled', updated_at = now() where id = budget_row.service_order_id and status = 'awaiting_approval';
  end if;
end;
$$;

create or replace function public.notify_budget_sent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sent' and old.status is distinct from 'sent' and new.owner_id is not null then
    insert into public.client_notifications(user_id, service_order_id, title, body)
    values(new.owner_id, new.service_order_id, 'Orçamento aguardando aprovação', 'A oficina enviou um orçamento. Abra o CR Connect para aprovar ou recusar.');
  end if;
  return new;
end;
$$;
drop trigger if exists on_budget_sent_notification on public.budgets;
create trigger on_budget_sent_notification after update of status on public.budgets for each row execute function public.notify_budget_sent();
