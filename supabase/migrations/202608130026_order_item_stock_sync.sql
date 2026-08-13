-- Baixa e estorno automático de peças usadas em uma Ordem de Serviço.
create or replace function public.sync_stock_from_order_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.kind = 'part' and old.product_id is not null then
    update public.products set quantity = quantity + old.quantity, updated_at = now() where id = old.product_id;
    delete from public.stock_movements where reference_type = 'service_order_item' and reference_id = old.id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.kind = 'part' and new.product_id is not null then
    update public.products set quantity = quantity - new.quantity, updated_at = now() where id = new.product_id;
    insert into public.stock_movements(workshop_id, product_id, kind, quantity, reference_type, reference_id, notes)
    values (new.workshop_id, new.product_id, 'out', new.quantity, 'service_order_item', new.id, 'Peça usada na O.S.') ;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_service_order_item_stock_sync on public.service_order_items;
create trigger on_service_order_item_stock_sync
after insert or update or delete on public.service_order_items
for each row execute function public.sync_stock_from_order_item();
