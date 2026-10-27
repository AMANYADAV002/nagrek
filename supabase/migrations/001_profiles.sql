-- =============================================================
-- Nagrek · Phase 1 · Profiles table & RLS
-- =============================================================

-- 1. Profiles Table
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  username             text unique,
  display_name         text,
  avatar_url           text,
  age_confirmed_at     timestamptz,
  location_cell        text,
  location_updated_at  timestamptz,
  role                 text not null default 'user' check (role in ('user', 'admin')),
  banned_at            timestamptz,
  ban_reason           text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

comment on table public.profiles is 'User profile, location grid cell, moderation role, and age confirmation.';

-- 2. Row Level Security
alter table public.profiles enable row level security;

-- Users can select their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using ( auth.uid() = id );

-- Users can insert their own profile row.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check ( auth.uid() = id );

-- Users can update their own profile row.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

-- Protect admin/moderation fields: authenticated users cannot update role, banned_at, or ban_reason.
create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() = 'authenticated' then
    if (new.role is distinct from old.role) or 
       (new.banned_at is distinct from old.banned_at) or 
       (new.ban_reason is distinct from old.ban_reason) then
      raise exception 'Unauthorized to modify admin/moderation fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_protect_profile_admin_fields on public.profiles;
create trigger tr_protect_profile_admin_fields
  before update on public.profiles
  for each row
  execute function public.protect_profile_admin_fields();

-- 3. Automatic profile creation on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', null),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', null),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
