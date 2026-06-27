
-- 1. Role enum
do $$ begin
  create type public.app_role as enum ('administrator', 'moderator', 'premium', 'standard');
exception when duplicate_object then null; end $$;

-- 2. user_roles
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- 3. has_role security-definer
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- Policies for user_roles
drop policy if exists "view own roles" on public.user_roles;
create policy "view own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'administrator'));

drop policy if exists "admin manage roles" on public.user_roles;
create policy "admin manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'administrator'))
  with check (public.has_role(auth.uid(), 'administrator'));

-- 4. login_history
create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

grant select, insert on public.login_history to authenticated;
grant all on public.login_history to service_role;

alter table public.login_history enable row level security;

drop policy if exists "own login history" on public.login_history;
create policy "own login history" on public.login_history for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'administrator'));

drop policy if exists "insert own login" on public.login_history;
create policy "insert own login" on public.login_history for insert to authenticated
  with check (auth.uid() = user_id);

create index if not exists login_history_user_idx on public.login_history(user_id, created_at desc);

-- 5. suspended flag on profiles
alter table public.profiles add column if not exists suspended boolean not null default false;

-- 6. Admin can view/update/delete any profile
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'administrator'));

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'administrator'))
  with check (public.has_role(auth.uid(), 'administrator'));

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles" on public.profiles for delete to authenticated
  using (public.has_role(auth.uid(), 'administrator'));

-- 7. Auto-grant administrator to the primary admin email on signup
create or replace function public.grant_primary_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'spikesprimo6625@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'administrator')
    on conflict (user_id, role) do nothing;
  else
    insert into public.user_roles (user_id, role)
    values (new.id, 'standard')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end $$;

revoke execute on function public.grant_primary_admin() from public, authenticated;

drop trigger if exists on_auth_user_grant_role on auth.users;
create trigger on_auth_user_grant_role
  after insert on auth.users
  for each row execute function public.grant_primary_admin();

-- 8. If the primary admin already exists, grant now
insert into public.user_roles (user_id, role)
select id, 'administrator'::public.app_role from auth.users
where lower(email) = 'spikesprimo6625@gmail.com'
on conflict (user_id, role) do nothing;
