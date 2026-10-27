-- =============================================================
-- Nagrek · Phase 4/Growth · waitlist, matches, friendships,
-- referrals, events
-- Apply in Supabase SQL editor after owner approves GATE-G1.
-- =============================================================

-- 1. Waitlist
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  city text,
  source text,
  created_at timestamptz default now(),
  constraint waitlist_email_unique unique (email)
);

alter table public.waitlist enable row level security;

drop policy if exists "waitlist_anon_insert" on public.waitlist;
-- Inserts go through service-role API only (rate-limited). No direct anon writes.
drop policy if exists "waitlist_select_service" on public.waitlist;

-- 2. Matches (call history)
create table if not exists public.matches (
  id text primary key,
  user_a uuid references auth.users(id) on delete set null,
  user_b uuid references auth.users(id) on delete set null,
  food text,
  region text,
  location_cell text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  outcome text check (outcome in ('accepted', 'skipped', 'timeout', 'failed', 'left')),
  rating_a smallint check (rating_a is null or rating_a between 1 and 5),
  rating_b smallint check (rating_b is null or rating_b between 1 and 5)
);

alter table public.matches enable row level security;

drop policy if exists "matches_select_participant" on public.matches;
create policy "matches_select_participant"
  on public.matches for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Inserts/updates via service role only (no client insert policy).

-- 3. Friendships
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  constraint friendships_no_self check (requester_id <> receiver_id)
);

create unique index if not exists friendships_pair_unique
  on public.friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id));

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_receiver_idx on public.friendships (receiver_id);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_participant" on public.friendships;
create policy "friendships_select_participant"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = receiver_id);

drop policy if exists "friendships_insert_requester" on public.friendships;
create policy "friendships_insert_requester"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

drop policy if exists "friendships_update_receiver" on public.friendships;
create policy "friendships_update_receiver"
  on public.friendships for update
  using (auth.uid() = receiver_id);

drop policy if exists "friendships_delete_either" on public.friendships;
create policy "friendships_delete_either"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = receiver_id);

-- Friends can read username + avatar of the other person
drop policy if exists "profiles_select_friends" on public.profiles;
create policy "profiles_select_friends"
  on public.profiles for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.receiver_id = profiles.id)
          or (f.receiver_id = auth.uid() and f.requester_id = profiles.id)
        )
    )
  );

-- 4. Referrals (reward deferred until payment gateway)
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint referrals_referred_unique unique (referred_id),
  constraint referrals_no_self check (referrer_id <> referred_id)
);

alter table public.referrals enable row level security;

drop policy if exists "referrals_select_referrer" on public.referrals;
create policy "referrals_select_referrer"
  on public.referrals for select
  using (auth.uid() = referrer_id);

-- 5. First-party analytics events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  props jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists events_name_created_idx on public.events (name, created_at desc);

alter table public.events enable row level security;
-- Service role inserts only; admins can select
drop policy if exists "events_select_admin" on public.events;
create policy "events_select_admin"
  on public.events for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
