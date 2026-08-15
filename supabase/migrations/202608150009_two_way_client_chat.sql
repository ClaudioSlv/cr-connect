-- Conversa privada entre a oficina e o proprietário do veículo.
alter table public.messages
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.messages enable row level security;

drop policy if exists "owner reads own chat" on public.messages;
drop policy if exists "owner sends own chat" on public.messages;
drop policy if exists "owner reads linked chat" on public.messages;
drop policy if exists "owner sends linked chat" on public.messages;

create policy "owner reads linked chat"
on public.messages for select
using (exists (select 1 from public.client_portal_links link where link.client_id = messages.client_id and link.user_id = auth.uid()));

create policy "owner sends linked chat"
on public.messages for insert
with check (owner_id = auth.uid() and exists (
  select 1 from public.client_portal_links link join public.clients client on client.id = link.client_id
  where link.client_id = messages.client_id and link.user_id = auth.uid() and client.workshop_id = messages.workshop_id
));

create or replace function public.get_owner_chat_threads()
returns table (client_id uuid, workshop_id uuid, client_name text, workshop_name text)
language sql
security definer
set search_path = public
as $function$
  select client.id, client.workshop_id, client.full_name, workshop.name
  from public.client_portal_links link
  join public.clients client on client.id = link.client_id
  join public.workshops workshop on workshop.id = client.workshop_id
  where link.user_id = auth.uid()
  order by workshop.name, client.full_name;
$function$;

create or replace function public.notify_client_chat()
returns trigger language plpgsql security definer set search_path = public
as $notify$
declare recipient uuid;
begin
  if new.owner_id is null then
    select link.user_id into recipient from public.client_portal_links link where link.client_id = new.client_id limit 1;
    if recipient is not null then
      insert into public.client_notifications(user_id, title, body) values (recipient, 'Nova mensagem da oficina', new.body);
    end if;
  else
    perform public.notify_workshop_members(new.workshop_id, 'Nova mensagem do cliente', new.body);
  end if;
  return new;
end;
$notify$;

drop trigger if exists on_client_chat_notification on public.messages;
create trigger on_client_chat_notification after insert on public.messages for each row execute function public.notify_client_chat();

grant execute on function public.get_owner_chat_threads() to authenticated;
