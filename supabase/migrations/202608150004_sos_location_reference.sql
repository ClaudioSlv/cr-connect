alter table public.sos_requests
  add column if not exists location_reference text,
  add column if not exists location_reference_at timestamptz;

alter table public.sos_requests
  drop constraint if exists sos_requests_location_reference_length_check;

alter table public.sos_requests
  add constraint sos_requests_location_reference_length_check
  check (location_reference is null or char_length(location_reference) <= 250);

create or replace function public.add_sos_location_reference(
  p_request_id uuid,
  p_location_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workshop_id uuid;
  v_reference text;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para enviar o detalhe.';
  end if;

  v_reference := left(trim(coalesce(p_location_reference, '')), 250);
  if char_length(v_reference) < 3 then
    raise exception 'Informe um ponto de referencia.';
  end if;

  update public.sos_requests
  set location_reference = v_reference,
      location_reference_at = now(),
      updated_at = now()
  where id = p_request_id
    and owner_id = auth.uid()
    and status = 'accepted'
  returning workshop_id into v_workshop_id;

  if not found then
    raise exception 'Este chamado nao pode receber detalhes agora.';
  end if;

  perform public.notify_workshop_members(
    v_workshop_id,
    'Detalhe de localizacao CR SOS',
    'O cliente enviou um ponto de referencia para o atendimento.'
  );
end;
$$;

grant execute on function public.add_sos_location_reference(uuid, text) to authenticated;
