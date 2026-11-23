-- Push notifications for Votaciones Escuela Sarmiento.
-- Run once after supabase-schema.sql and supabase-media-chat-migration.sql.
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth text not null,
 created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, public;
grant select, insert, delete on public.push_subscriptions to authenticated;
drop policy if exists "Users read own push subscriptions" on public.push_subscriptions;
create policy "Users read own push subscriptions" on public.push_subscriptions for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Users add own push subscriptions" on public.push_subscriptions;
create policy "Users add own push subscriptions" on public.push_subscriptions for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users remove own push subscriptions" on public.push_subscriptions;
create policy "Users remove own push subscriptions" on public.push_subscriptions for delete to authenticated using ((select auth.uid())=user_id);

create table if not exists public.push_config (
 id boolean primary key default true check (id),
 vapid_public_key text,
 vapid_private_key text,
 webhook_secret text not null default encode(gen_random_bytes(32),'hex'),
 updated_at timestamptz not null default now()
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated, public;
insert into public.push_config(id) values(true) on conflict(id) do nothing;

create or replace function public.dispatch_push_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare hook_secret text; event_payload jsonb;
begin
 select webhook_secret into hook_secret from public.push_config where id=true;
 if hook_secret is null then return new; end if;
 if tg_table_name='messages' then
  event_payload=jsonb_build_object('kind','message','group_id',new.group_id,'sender_id',new.user_id,'message_type',new.message_type,'attachment_name',new.attachment_name);
 elsif tg_table_name='candidates' and tg_op='INSERT' then
  event_payload=jsonb_build_object('kind','candidate_pending','candidate_id',new.id,'owner_id',new.user_id);
 elsif tg_table_name='candidates' and tg_op='UPDATE' then
  if old.status is not distinct from new.status then return new; end if;
  event_payload=jsonb_build_object('kind','candidate_status','candidate_id',new.id,'owner_id',new.user_id,'status',new.status);
 else return new;
 end if;
 perform net.http_post(
  url:='https://fcibtyumzxuthnjecwpv.supabase.co/functions/v1/send-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-vse-hook',hook_secret),
  body:=event_payload,timeout_milliseconds:=5000
 );
 return new;
end $$;
revoke all on function public.dispatch_push_event() from public,anon,authenticated;

drop trigger if exists push_on_new_message on public.messages;
create trigger push_on_new_message after insert on public.messages for each row execute function public.dispatch_push_event();
drop trigger if exists push_on_new_candidate on public.candidates;
create trigger push_on_new_candidate after insert on public.candidates for each row execute function public.dispatch_push_event();
drop trigger if exists push_on_candidate_status on public.candidates;
create trigger push_on_candidate_status after update of status on public.candidates for each row execute function public.dispatch_push_event();
