create table if not exists public.customer_part_terms (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  token uuid not null default gen_random_uuid() unique,
  client_name text not null,
  client_phone text not null,
  vehicle_label text,
  service_description text,
  part_description text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  response_ip text,
  response_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_part_terms enable row level security;
create policy workshop_access on public.customer_part_terms for all
using (public.is_workshop_member(workshop_id))
with check (public.is_workshop_member(workshop_id));

create index if not exists customer_part_terms_workshop_created_idx on public.customer_part_terms(workshop_id, created_at desc);
create index if not exists customer_part_terms_token_idx on public.customer_part_terms(token);

create or replace function public.record_customer_part_term_response(
  p_token uuid,
  p_response text,
  p_ip text default null,
  p_user_agent text default null
)
returns public.customer_part_terms
language plpgsql security definer set search_path = public as $$
declare
  term_row public.customer_part_terms;
  response_status text;
begin
  if p_response not in ('accepted','rejected') then raise exception 'Resposta inválida.'; end if;
  select * into term_row from public.customer_part_terms where token = p_token for update;
  if not found then raise exception 'Termo não encontrado.'; end if;
  if term_row.status <> 'pending' then return term_row; end if;
  response_status := p_response;
  update public.customer_part_terms
  set status = response_status,
      viewed_at = coalesce(viewed_at, now()),
      accepted_at = case when response_status = 'accepted' then now() else null end,
      rejected_at = case when response_status = 'rejected' then now() else null end,
      response_ip = p_ip,
      response_user_agent = p_user_agent,
      updated_at = now()
  where id = term_row.id
  returning * into term_row;
  perform public.notify_workshop_members(
    term_row.workshop_id,
    case when response_status = 'accepted' then 'Termo de responsabilidade aceito' else 'Termo de responsabilidade recusado' end,
    term_row.client_name || case when response_status = 'accepted' then ' aceitou o termo da peça fornecida.' else ' recusou o termo da peça fornecida.' end
  );
  return term_row;
end;
$$;

grant execute on function public.record_customer_part_term_response(uuid, text, text, text) to anon, authenticated;
