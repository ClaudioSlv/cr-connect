-- Deliver new notification records to active CR Connect sessions immediately.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end;
$$;
