alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public)
values ('owner-avatars', 'owner-avatars', false)
on conflict (id) do update set public = false;

drop policy if exists "owner reads own avatar" on storage.objects;
create policy "owner reads own avatar" on storage.objects for select to authenticated using (bucket_id = 'owner-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owner uploads own avatar" on storage.objects;
create policy "owner uploads own avatar" on storage.objects for insert to authenticated with check (bucket_id = 'owner-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owner updates own avatar" on storage.objects;
create policy "owner updates own avatar" on storage.objects for update to authenticated using (bucket_id = 'owner-avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'owner-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
