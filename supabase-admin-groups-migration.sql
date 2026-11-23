-- Votaciones Escuela Sarmiento: controles de dueño de grupo y administración.
-- La migración ya fue aplicada al proyecto Supabase de producción.

alter table public.profiles add column if not exists suspended boolean not null default false;
create table if not exists public.platform_settings (
 id boolean primary key default true check(id),
 voting_open boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.platform_settings(id,voting_open) values(true,true) on conflict(id) do nothing;
alter table public.platform_settings enable row level security;
drop policy if exists "platform settings readable" on public.platform_settings;
create policy "platform settings readable" on public.platform_settings for select to authenticated using(true);

create or replace function public.owner_update_group(p_group_id uuid,p_name text,p_description text,p_password_hash text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
 if not exists(select 1 from public.chat_groups where id=p_group_id and created_by=auth.uid()) then raise exception 'Solo el dueño puede configurar este grupo.'; end if;
 if char_length(trim(p_name)) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.'; end if;
 if p_password_hash is not null and p_password_hash !~ '^[a-f0-9]{64}$' then raise exception 'Contraseña no válida.'; end if;
 update public.chat_groups set name=trim(p_name),description=coalesce(trim(p_description),''),password_hash=coalesce(p_password_hash,password_hash) where id=p_group_id;
end; $$;
create or replace function public.owner_remove_group_member(p_group_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.chat_groups where id=p_group_id and created_by=auth.uid()) then raise exception 'Solo el dueño puede administrar integrantes.'; end if;
 if p_user_id=auth.uid() then raise exception 'No podés quitarte a vos mismo desde esta opción.'; end if;
 delete from public.group_members where group_id=p_group_id and user_id=p_user_id;
end; $$;
create or replace function public.owner_delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.chat_groups where id=p_group_id and created_by=auth.uid()) then raise exception 'Solo el dueño puede eliminar este grupo.'; end if;
 delete from public.chat_groups where id=p_group_id;
end; $$;
create or replace function public.admin_set_user_suspended(p_user_id uuid,p_suspended boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=auth.uid() and role='admin' and not suspended) then raise exception 'Solo administración puede hacer esto.'; end if;
 if p_user_id=auth.uid() then raise exception 'No podés suspender tu propia cuenta.'; end if;
 update public.profiles set suspended=p_suspended where user_id=p_user_id;
end; $$;
create or replace function public.admin_set_voting_open(p_open boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=auth.uid() and role='admin' and not suspended) then raise exception 'Solo administración puede hacer esto.'; end if;
 update public.platform_settings set voting_open=p_open,updated_at=now() where id=true;
end; $$;
create or replace function public.admin_delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=auth.uid() and role='admin' and not suspended) then raise exception 'Solo administración puede hacer esto.'; end if;
 delete from public.chat_groups where id=p_group_id;
end; $$;
create or replace function public.admin_delete_message(p_message_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=auth.uid() and role='admin' and not suspended) then raise exception 'Solo administración puede hacer esto.'; end if;
 delete from public.messages where id=p_message_id;
end; $$;
create or replace function public.admin_set_candidate_status(p_candidate_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=auth.uid() and role='admin' and not suspended) then raise exception 'Solo administración puede hacer esto.'; end if;
 if p_status not in ('pending','approved','rejected') then raise exception 'Estado inválido.'; end if;
 update public.candidates set status=p_status where id=p_candidate_id;
end; $$;
create or replace function public.cast_vote(candidate_uuid uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate_owner uuid; is_open boolean;
begin
 if auth.uid() is null then raise exception 'Tenés que iniciar sesión para votar.'; end if;
 if exists(select 1 from public.profiles where user_id=auth.uid() and suspended) then raise exception 'Tu cuenta está suspendida.'; end if;
 select voting_open into is_open from public.platform_settings where id=true;
 if coalesce(is_open,true)=false then raise exception 'La votación está cerrada.'; end if;
 select user_id into candidate_owner from public.candidates where id=candidate_uuid and status='approved';
 if candidate_owner is null then raise exception 'Este proyecto no está aprobado para votar.'; end if;
 insert into public.votes(user_id,candidate_id) values(auth.uid(),candidate_uuid);
 return jsonb_build_object('success',true);
exception when unique_violation then raise exception 'Ya emitiste tu voto. Solo se permite un voto por cuenta.';
end; $$;

revoke all on function public.owner_update_group(uuid,text,text,text) from public,anon;
revoke all on function public.owner_remove_group_member(uuid,uuid) from public,anon;
revoke all on function public.owner_delete_group(uuid) from public,anon;
revoke all on function public.admin_set_user_suspended(uuid,boolean) from public,anon;
revoke all on function public.admin_set_voting_open(boolean) from public,anon;
revoke all on function public.admin_delete_group(uuid) from public,anon;
revoke all on function public.admin_delete_message(uuid) from public,anon;
revoke all on function public.admin_set_candidate_status(uuid,text) from public,anon;
grant execute on function public.owner_update_group(uuid,text,text,text) to authenticated;
grant execute on function public.owner_remove_group_member(uuid,uuid) to authenticated;
grant execute on function public.owner_delete_group(uuid) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid,boolean) to authenticated;
grant execute on function public.admin_set_voting_open(boolean) to authenticated;
grant execute on function public.admin_delete_group(uuid) to authenticated;
grant execute on function public.admin_delete_message(uuid) to authenticated;
grant execute on function public.admin_set_candidate_status(uuid,text) to authenticated;

drop policy if exists "owner or admin update groups" on public.chat_groups;
create policy "owner or admin update groups" on public.chat_groups for update to authenticated using(created_by=auth.uid() or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and not p.suspended)) with check(created_by=auth.uid() or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and not p.suspended));
drop policy if exists "owner or admin delete groups" on public.chat_groups;
create policy "owner or admin delete groups" on public.chat_groups for delete to authenticated using(created_by=auth.uid() or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and not p.suspended));
drop policy if exists "owner admin remove members" on public.group_members;
create policy "owner admin remove members" on public.group_members for delete to authenticated using(user_id=auth.uid() or exists(select 1 from public.chat_groups g where g.id=group_id and g.created_by=auth.uid()) or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and not p.suspended));
drop policy if exists "admins delete messages" on public.messages;
create policy "admins delete messages" on public.messages for delete to authenticated using(exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and not p.suspended) or user_id=auth.uid());
drop policy if exists "read own membership" on public.group_members;
create policy "read own membership" on public.group_members for select to authenticated using (
 user_id=auth.uid()
 or exists(select 1 from public.chat_groups g where g.id=group_id and g.created_by=auth.uid())
 or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and not p.suspended)
);
create or replace function public.reject_suspended_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.profiles where user_id=auth.uid() and suspended) then raise exception 'Tu cuenta está suspendida. No podés realizar esta acción.'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.reject_suspended_user() from public,anon,authenticated;
drop trigger if exists reject_suspended_candidates on public.candidates;
create trigger reject_suspended_candidates before insert or update or delete on public.candidates for each row execute function public.reject_suspended_user();
drop trigger if exists reject_suspended_groups on public.chat_groups;
create trigger reject_suspended_groups before insert or update or delete on public.chat_groups for each row execute function public.reject_suspended_user();
drop trigger if exists reject_suspended_members on public.group_members;
create trigger reject_suspended_members before insert or update or delete on public.group_members for each row execute function public.reject_suspended_user();
drop trigger if exists reject_suspended_messages on public.messages;
create trigger reject_suspended_messages before insert or update or delete on public.messages for each row execute function public.reject_suspended_user();
