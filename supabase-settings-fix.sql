-- Small repair migration for settings and profile permissions.
-- Students may edit their own display name but cannot change their role.
-- Admins may edit their own display name while retaining the admin role.
drop policy if exists "admin profile owner update name" on public.profiles;
create policy "admin profile owner update name"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id and role = 'admin')
with check (auth.uid() = user_id and role = 'admin');
