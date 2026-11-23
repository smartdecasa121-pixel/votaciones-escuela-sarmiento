-- Migración idempotente: ejecutar en Supabase SQL Editor si se prepara otra instancia.
alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint,
  add column if not exists message_type text not null default 'text';

alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages drop constraint if exists messages_body_or_attachment_check;
alter table public.messages add constraint messages_body_or_attachment_check
 check ((char_length(trim(body)) between 1 and 1000) or (attachment_path is not null and char_length(trim(body))=0));
alter table public.messages drop constraint if exists messages_attachment_size_check;
alter table public.messages add constraint messages_attachment_size_check
 check (attachment_size is null or attachment_size between 1 and 20971520);
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
 check (message_type in ('text','image','audio','file'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-attachments','chat-attachments',false,20971520,
 array['image/jpeg','image/png','image/webp','image/gif','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/aac','audio/x-wav','audio/flac','audio/3gpp','audio/x-m4a',
 'application/pdf','text/plain','text/csv','application/zip',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Chat members upload their own attachments" on storage.objects;
create policy "Chat members upload their own attachments" on storage.objects for insert to authenticated
with check(bucket_id='chat-attachments' and (storage.foldername(name))[2]=(select auth.uid()::text)
 and exists(select 1 from public.group_members gm where gm.group_id::text=(storage.foldername(name))[1] and gm.user_id=(select auth.uid())));
drop policy if exists "Chat members read group attachments" on storage.objects;
create policy "Chat members read group attachments" on storage.objects for select to authenticated
using(bucket_id='chat-attachments' and exists(select 1 from public.group_members gm where gm.group_id::text=(storage.foldername(name))[1] and gm.user_id=(select auth.uid())));
drop policy if exists "Owners delete their chat attachments" on storage.objects;
create policy "Owners delete their chat attachments" on storage.objects for delete to authenticated
using(bucket_id='chat-attachments' and (storage.foldername(name))[2]=(select auth.uid()::text));

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
 alter publication supabase_realtime add table public.messages;
 end if;
end $$;
