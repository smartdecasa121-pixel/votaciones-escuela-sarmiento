-- Votaciones Escuela Sarmiento: pegar TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Solo se expone la clave publicable (anon/publishable) en el navegador. Nunca usar service_role aquí.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id,display_name,role)
  values(new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Estudiante'), 'student')
  on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 100),
  description text not null check (char_length(trim(description)) between 5 and 1200),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  password_hash text not null,
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists chat_groups_name_ci_unique on public.chat_groups(lower(name));
create table if not exists public.group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_group_created_idx on public.messages(group_id,created_at);

alter table public.profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.votes enable row level security;
alter table public.chat_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.messages enable row level security;

-- Perfiles solo contienen nombre visible y rol; no guardan correos ni contraseñas.
drop policy if exists "profiles visible" on public.profiles;
create policy "profiles visible" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "profile owner update name" on public.profiles;
create policy "profile owner update name" on public.profiles for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id and role='student');
-- La creación de perfil la hace el trigger de Auth.

drop policy if exists "approved candidates public and own pending" on public.candidates;
create policy "approved candidates public and own pending" on public.candidates for select to anon, authenticated using (status='approved' or user_id=auth.uid() or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin'));
drop policy if exists "students submit own pending candidates" on public.candidates;
create policy "students submit own pending candidates" on public.candidates for insert to authenticated with check (user_id=auth.uid() and status='pending');
drop policy if exists "admin moderate candidates" on public.candidates;
create policy "admin moderate candidates" on public.candidates for update to authenticated using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin'));

-- No se permite leer votos individuales desde el cliente.
drop policy if exists "read own vote" on public.votes;
create policy "read own vote" on public.votes for select to authenticated using (user_id=auth.uid());

-- Los grupos solo son visibles para sus integrantes o la persona administradora.
drop policy if exists "members read groups" on public.chat_groups;
create policy "members read groups" on public.chat_groups for select to authenticated using (exists(select 1 from public.group_members gm where gm.group_id=id and gm.user_id=auth.uid()) or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin'));
drop policy if exists "members read membership" on public.group_members;
drop policy if exists "read own membership" on public.group_members;
create policy "read own membership" on public.group_members for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin'));
drop policy if exists "group members read messages" on public.messages;
create policy "group members read messages" on public.messages for select to authenticated using (exists(select 1 from public.group_members gm where gm.group_id=messages.group_id and gm.user_id=auth.uid()));
drop policy if exists "members send own messages" on public.messages;
create policy "members send own messages" on public.messages for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.group_members gm where gm.group_id=messages.group_id and gm.user_id=auth.uid()));

create or replace function public.cast_vote(candidate_uuid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate_owner uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión para votar.'; end if;
  select user_id into candidate_owner from public.candidates where id=candidate_uuid and status='approved';
  if candidate_owner is null then raise exception 'Este proyecto no está aprobado para votar.'; end if;
  insert into public.votes(user_id,candidate_id) values(auth.uid(),candidate_uuid);
  return jsonb_build_object('success',true);
exception when unique_violation then raise exception 'Ya emitiste tu voto. Solo se permite un voto por cuenta.';
end; $$;
revoke all on function public.cast_vote(uuid) from public;
grant execute on function public.cast_vote(uuid) to authenticated;

create or replace function public.public_vote_results()
returns table(candidate_id uuid,vote_count bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, count(v.id) from public.candidates c left join public.votes v on v.candidate_id=c.id
  where c.status='approved' group by c.id;
$$;
revoke all on function public.public_vote_results() from public;
grant execute on function public.public_vote_results() to anon, authenticated;

create or replace function public.create_chat_group(group_name text, group_description text, group_password_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión primero.'; end if;
 if char_length(trim(group_name)) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.'; end if;
 if group_password_hash !~ '^[a-f0-9]{64}$' then raise exception 'Contraseña no válida.'; end if;
 insert into public.chat_groups(name,description,password_hash,created_by) values(trim(group_name),coalesce(trim(group_description),''),group_password_hash,auth.uid()) returning id into new_id;
 insert into public.group_members(group_id,user_id) values(new_id,auth.uid());
 return new_id;
end; $$;
revoke all on function public.create_chat_group(text,text,text) from public;
grant execute on function public.create_chat_group(text,text,text) to authenticated;

create or replace function public.join_chat_group(group_name text, group_password_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare found_id uuid;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión primero.'; end if;
 select id into found_id from public.chat_groups where lower(name)=lower(trim(group_name)) and password_hash=group_password_hash;
 if found_id is null then raise exception 'Nombre o contraseña incorrectos.'; end if;
 insert into public.group_members(group_id,user_id) values(found_id,auth.uid()) on conflict do nothing;
 return found_id;
end; $$;
revoke all on function public.join_chat_group(text,text) from public;
grant execute on function public.join_chat_group(text,text) to authenticated;

-- Realtime para el chat: en Dashboard > Database > Replication, habilitá public.messages si aún no está habilitado.
