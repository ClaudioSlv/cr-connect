-- Public visitors never access these tables directly. Only server-side service_role.
create table if not exists public.bolao_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (length(endpoint) <= 4096),
  p256dh text not null,
  auth text not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  consent_version text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table if not exists public.bolao_push_deliveries (
  subscription_id uuid not null references public.bolao_push_subscriptions(id) on delete cascade,
  reminder_key text not null,
  scheduled_at timestamptz not null,
  status text not null default 'claimed' check (status in ('claimed','sent','retryable','invalid','uncertain')),
  attempts integer not null default 1,
  attempted_at timestamptz not null default now(),
  retry_after timestamptz,
  sent_at timestamptz,
  last_status_code integer,
  primary key (subscription_id, reminder_key)
);

create index if not exists bolao_push_subscriptions_active_idx
  on public.bolao_push_subscriptions(id) where active;
alter table public.bolao_push_subscriptions enable row level security;
alter table public.bolao_push_deliveries enable row level security;
revoke all on public.bolao_push_subscriptions from anon, authenticated;
revoke all on public.bolao_push_deliveries from anon, authenticated;
grant all on public.bolao_push_subscriptions to service_role;
grant all on public.bolao_push_deliveries to service_role;

-- Atomic claim. Duplicate cron calls cannot both claim the same notification.
-- Only explicit retryable provider rejections may retry (at most three attempts).
-- A crash/unknown transport result is NOT reclaimed: avoids a second notification
-- if the provider already accepted the first one before the connection was lost.
create or replace function public.claim_bolao_push_delivery(
  p_subscription_id uuid,
  p_reminder_key text,
  p_scheduled_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare claimed boolean;
begin
  insert into public.bolao_push_deliveries(subscription_id, reminder_key, scheduled_at)
    select id, p_reminder_key, p_scheduled_at
    from public.bolao_push_subscriptions
    where id = p_subscription_id and active
  on conflict (subscription_id, reminder_key) do update
    set status = 'claimed', attempts = bolao_push_deliveries.attempts + 1,
        attempted_at = now(), retry_after = null
    where bolao_push_deliveries.status = 'retryable'
      and bolao_push_deliveries.attempts < 3
      and bolao_push_deliveries.retry_after <= now()
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;
revoke all on function public.claim_bolao_push_delivery(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_bolao_push_delivery(uuid, text, timestamptz) to service_role;
