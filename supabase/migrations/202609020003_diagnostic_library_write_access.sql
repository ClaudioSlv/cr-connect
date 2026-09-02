drop policy if exists dtcs_write_access on public.dtcs;
create policy dtcs_write_access on public.dtcs
for all using (workshop_id is not null and public.is_workshop_member(workshop_id))
with check (workshop_id is not null and public.is_workshop_member(workshop_id));

drop policy if exists technical_data_write_access on public.technical_data;
create policy technical_data_write_access on public.technical_data
for all using (workshop_id is not null and public.is_workshop_member(workshop_id))
with check (workshop_id is not null and public.is_workshop_member(workshop_id));
