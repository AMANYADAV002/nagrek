-- =============================================================
-- Nagrek · Phase 3 · Safety, Blocks & Reports
-- =============================================================

-- 1. Blocks Table
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);

comment on table public.blocks is 'Block pairs: matching excludes pairs in either direction.';

alter table public.blocks enable row level security;

-- Blocker manages own blocks
drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own"
  on public.blocks for select
  using ( auth.uid() = blocker_id );

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own"
  on public.blocks for insert
  with check ( auth.uid() = blocker_id );

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own"
  on public.blocks for delete
  using ( auth.uid() = blocker_id );

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

-- 2. Reports Table
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  reported_id  uuid references auth.users(id) on delete set null,
  match_id     text,
  reason       text not null,
  status       text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at   timestamptz default now()
);

comment on table public.reports is 'User abuse reports. Reporters insert; admins select and update.';

alter table public.reports enable row level security;

-- Reporters can insert their own reports
drop policy if exists "reports_insert_reporter" on public.reports;
create policy "reports_insert_reporter"
  on public.reports for insert
  with check ( auth.uid() = reporter_id );

-- Only admins can select or update reports
drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin"
  on public.reports for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
