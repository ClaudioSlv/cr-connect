-- Permite que somente o administrador altere os dados da própria oficina,
-- incluindo a configuração de GPS e disponibilidade do CR SOS.
drop policy if exists "admins can update workshop" on public.workshops;
create policy "admins can update workshop"
on public.workshops
for update
using (
  exists (
    select 1
    from public.workshop_users
    where workshop_users.workshop_id = workshops.id
      and workshop_users.user_id = auth.uid()
      and workshop_users.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.workshop_users
    where workshop_users.workshop_id = workshops.id
      and workshop_users.user_id = auth.uid()
      and workshop_users.role = 'admin'
  )
);
