create table if not exists public.sos_owner_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  sos_request_id uuid not null references public.sos_requests(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sos_owner_notifications enable row level security;
drop policy if exists "owner reads SOS updates" on public.sos_owner_notifications;
create policy "owner reads SOS updates" on public.sos_owner_notifications for select using (owner_id = auth.uid());
drop policy if exists "owner updates SOS updates" on public.sos_owner_notifications;
create policy "owner updates SOS updates" on public.sos_owner_notifications for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index if not exists sos_owner_notifications_owner_created_idx on public.sos_owner_notifications(owner_id, created_at desc);

create or replace function public.notify_sos_owner_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare workshop_name text; notification_title text; notification_body text;
begin
  if new.owner_id is null or new.status is not distinct from old.status then return new; end if;
  select name into workshop_name from public.workshops where id = new.workshop_id;
  case new.status
    when 'accepted' then notification_title := 'CR SOS aceito'; notification_body := coalesce(workshop_name, 'A oficina') || ' aceitou seu chamado e vai atender você.';
    when 'declined' then notification_title := 'CR SOS indisponível'; notification_body := coalesce(workshop_name, 'A oficina') || ' não conseguiu aceitar este chamado.';
    when 'completed' then notification_title := 'Atendimento concluído'; notification_body := coalesce(workshop_name, 'A oficina') || ' marcou o atendimento como concluído. Você já pode avaliar.';
    else return new;
  end case;
  insert into public.sos_owner_notifications(owner_id, sos_request_id, title, body) values (new.owner_id, new.id, notification_title, notification_body);
  return new;
end;
$$;

drop trigger if exists sos_request_owner_status_notification on public.sos_requests;
create trigger sos_request_owner_status_notification after update of status on public.sos_requests for each row execute function public.notify_sos_owner_status();

create or replace function public.get_sos_request_status(p_request_id uuid)
returns table(status public.sos_status, viewed_at timestamptz, workshop_name text)
language sql security definer set search_path = public as $$
  select request.status, request.viewed_at, workshop.name from public.sos_requests request left join public.workshops workshop on workshop.id = request.workshop_id where request.id = p_request_id;
$$;
grant execute on function public.get_sos_request_status(uuid) to anon, authenticated;
