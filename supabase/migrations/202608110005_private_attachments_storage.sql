insert into storage.buckets (id, name, public)
values ('workshop-attachments', 'workshop-attachments', false)
on conflict (id) do nothing;

create policy "workshop attachment read" on storage.objects for select to authenticated
using (bucket_id = 'workshop-attachments' and public.is_workshop_member((storage.foldername(name))[1]::uuid));

create policy "workshop attachment upload" on storage.objects for insert to authenticated
with check (bucket_id = 'workshop-attachments' and public.is_workshop_member((storage.foldername(name))[1]::uuid));

create policy "workshop attachment delete" on storage.objects for delete to authenticated
using (bucket_id = 'workshop-attachments' and public.is_workshop_member((storage.foldername(name))[1]::uuid));
