-- A photo for the organiser's You picture (Raj, 20 Nov 2026).
-- Public bucket so the picture loads quickly everywhere; each file name is random,
-- and only the organiser can add, replace or remove files in their own folder.

alter table public.profiles add column avatar_path text check (char_length(avatar_path) <= 300);
comment on column public.profiles.avatar_path is 'Path of the You picture in the avatars bucket, e.g. <user id>/<random>.jpg.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "organisers add their own photo" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "organisers see their own photo files" on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "organisers remove their own photo" on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
