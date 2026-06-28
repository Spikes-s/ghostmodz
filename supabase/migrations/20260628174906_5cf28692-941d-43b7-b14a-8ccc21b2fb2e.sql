
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke execute on function private.has_role(uuid, public.app_role) from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

-- Drop ALL policies that reference public.has_role
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;
drop policy if exists "own login history" on public.login_history;
drop policy if exists "users view own logins" on public.login_history;
drop policy if exists "admins view all logins" on public.login_history;
drop policy if exists "view own roles" on public.user_roles;
drop policy if exists "admin manage roles" on public.user_roles;

-- Recreate using private.has_role
create policy "Admins can view all profiles" on public.profiles for select to authenticated
  using (private.has_role(auth.uid(), 'administrator'));
create policy "Admins can update all profiles" on public.profiles for update to authenticated
  using (private.has_role(auth.uid(), 'administrator'))
  with check (private.has_role(auth.uid(), 'administrator'));
create policy "Admins can delete profiles" on public.profiles for delete to authenticated
  using (private.has_role(auth.uid(), 'administrator'));

create policy "own login history" on public.login_history for select to authenticated
  using (auth.uid() = user_id or private.has_role(auth.uid(), 'administrator'));

create policy "view own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or private.has_role(auth.uid(), 'administrator'));
create policy "admins insert roles" on public.user_roles for insert to authenticated
  with check (private.has_role(auth.uid(), 'administrator'));
create policy "admins update roles" on public.user_roles for update to authenticated
  using (private.has_role(auth.uid(), 'administrator'))
  with check (private.has_role(auth.uid(), 'administrator'));
create policy "admins delete roles" on public.user_roles for delete to authenticated
  using (private.has_role(auth.uid(), 'administrator'));

-- Now safe to drop public.has_role
drop function if exists public.has_role(uuid, public.app_role);

-- Lock down trigger-only SECURITY DEFINER functions from API callers
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.grant_primary_admin() from public, anon, authenticated;

-- Storage: missing UPDATE policy for spikes-uploads
drop policy if exists "spikes uploads update own" on storage.objects;
create policy "spikes uploads update own" on storage.objects for update to authenticated
  using (bucket_id = 'spikes-uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'spikes-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
