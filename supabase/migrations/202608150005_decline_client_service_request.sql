-- A oficina recusa uma solicitação de O.S. e o cliente recebe o aviso no portal.
create or replace function public.decline_client_service_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare request_row public.service_requests%rowtype;
begin
  select * into request_row from public.service_requests where id = p_request_id for update;
  if request_row.id is null or not public.is_workshop_member(request_row.workshop_id) then
    raise exception 'Solicitação não encontrada.';
  end if;
  if request_row.status <> 'requested' then
    raise exception 'Esta solicitação já foi respondida.';
  end if;
  update public.service_requests set status = 'declined', responded_at = now() where id = p_request_id;
  insert into public.client_notifications(user_id, title, body)
  values (request_row.owner_id, 'Solicitação de O.S. recusada', 'A oficina não poderá atender esta solicitação neste momento.');
end;
$$;

grant execute on function public.decline_client_service_request(uuid) to authenticated;
