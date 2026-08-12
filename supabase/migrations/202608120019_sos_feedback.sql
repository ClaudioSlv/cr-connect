alter table public.sos_requests
  add column if not exists feedback_rating smallint,
  add column if not exists feedback_text text,
  add column if not exists feedback_at timestamptz;

alter table public.sos_requests
  drop constraint if exists sos_requests_feedback_rating_check;

alter table public.sos_requests
  add constraint sos_requests_feedback_rating_check
  check (feedback_rating is null or feedback_rating between 1 and 5);

alter table public.sos_requests
  drop constraint if exists sos_requests_feedback_text_length_check;

alter table public.sos_requests
  add constraint sos_requests_feedback_text_length_check
  check (feedback_text is null or char_length(feedback_text) <= 150);

create or replace function public.submit_sos_feedback(
  p_request_id uuid,
  p_rating smallint,
  p_feedback text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workshop_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para avaliar o atendimento.';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'A avaliação deve ter de 1 a 5 estrelas.';
  end if;

  update public.sos_requests
  set feedback_rating = p_rating,
      feedback_text = nullif(left(trim(coalesce(p_feedback, '')), 150), ''),
      feedback_at = now(),
      updated_at = now()
  where id = p_request_id
    and owner_id = auth.uid()
    and status = 'completed'
  returning workshop_id into v_workshop_id;

  if not found then
    raise exception 'Este chamado não pode ser avaliado agora.';
  end if;

  if v_workshop_id is not null then
    perform public.notify_workshop_members(
      v_workshop_id,
      'Nova avaliação CR SOS',
      'Um cliente deixou uma avaliação de ' || p_rating || ' estrela(s).'
    );
  end if;
end;
$$;

grant execute on function public.submit_sos_feedback(uuid, smallint, text) to authenticated;

create or replace function public.get_sos_workshop_reviews(p_workshop_id uuid)
returns table (
  requester_name text,
  rating smallint,
  feedback text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    split_part(s.requester_name, ' ', 1) as requester_name,
    s.feedback_rating as rating,
    s.feedback_text as feedback,
    s.feedback_at as created_at
  from public.sos_requests s
  where s.workshop_id = p_workshop_id
    and s.status = 'completed'
    and s.feedback_rating is not null
  order by s.feedback_at desc
  limit 30;
$$;

grant execute on function public.get_sos_workshop_reviews(uuid) to anon, authenticated;
