-- Nagrek schema. Run this in the Supabase SQL editor, or via `supabase db push`.
-- Then run supabase/seed.sql. Row Level Security is on for every table.
-- Exact coordinates and date of birth live in user_preferences (owner-only).
-- Coupon codes live in reward_codes, which has no client policies (service role only).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Plans and catalog (public read, no client writes)
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key check (id in ('plus', 'premium', 'ultra')),
  name text not null,
  tagline text not null,
  price_inr integer not null check (price_inr >= 0),
  period text not null default 'month',
  rank integer not null,
  highlight boolean not null default false,
  daily_matches integer, -- null means unlimited
  music boolean not null default false,
  priority_matching boolean not null default false,
  reward_tier integer not null check (reward_tier between 1 and 3),
  perks text[] not null default '{}'
);

create table public.avatar_items (
  id text not null,
  category text not null,
  label text not null,
  price_inr integer not null default 0 check (price_inr >= 0),
  unlock_type text check (unlock_type in ('streak', 'plan')),
  unlock_value text,
  primary key (category, id)
);

create table public.music_tracks (
  id text primary key,
  title text not null,
  mood text not null,
  preset text not null,
  src text
);

create table public.sponsors (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('cafe', 'restaurant', 'hotel')),
  city text not null
);

create table public.rewards (
  id text primary key,
  sponsor_id text not null references public.sponsors (id),
  title text not null,
  description text not null default '',
  min_streak integer not null check (min_streak > 0),
  min_plan text not null references public.plans (id),
  expires_at date not null,
  stock integer not null default 0 check (stock >= 0)
);

-- Codes are never selectable by the browser. Service role bypasses RLS.
create table public.reward_codes (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.rewards (id) on delete cascade,
  code text not null,
  claimed_by uuid,
  claimed_at timestamptz,
  unique (reward_id, code)
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  handle text not null unique,
  bio text not null default '',
  city text,
  area text,
  tone text check (tone in ('professional', 'casual', 'random')),
  food_interests text[] not null default '{}',
  avatar jsonb not null default '{"skin":"s2","hair":"short","hairColor":"black","outfit":"tee","accessory":"none","background":"peach"}'::jsonb,
  plan_id text references public.plans (id),
  plan_since timestamptz,
  onboarded_at timestamptz,
  notifications_enabled boolean not null default true,
  trust_score numeric(3, 2) not null default 5.00,
  suspended boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reward_codes
  add constraint reward_codes_claimed_by_fkey foreign key (claimed_by) references public.profiles (id);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  food_interests text[] not null,
  tone text not null check (tone in ('professional', 'casual', 'random')),
  city text not null,
  area text,
  -- Rounded to 2 decimals (~1 km) before insert. Owner-only.
  lat numeric(8, 2),
  lng numeric(8, 2),
  dietary text not null,
  budget_min integer not null,
  budget_max integer not null,
  group_size text not null check (group_size in ('one-on-one', 'small-group')),
  time_slots text[] not null default '{}',
  languages text[] not null default '{}',
  topics text[] not null default '{}',
  goals text[] not null default '{}',
  date_of_birth date not null,
  constraint adult_dob check (date_of_birth <= (current_date - interval '18 years')),
  constraint budget_order check (budget_min < budget_max)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  adult boolean not null,
  respectful boolean not null,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  constraint consent_must_be_yes check (adult and respectful),
  unique (user_id, terms_version)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null check (status in ('active', 'cancelled', 'past_due')),
  -- 'mock' until Razorpay (phase 3) writes 'razorpay'.
  provider text not null default 'mock',
  provider_ref text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_inr integer not null,
  purpose text not null,
  status text not null,
  provider_ref text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint no_self_connect check (requester_id <> addressee_id)
);

create unique index connections_pair_idx on public.connections (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create table public.mutes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_id)
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('place', 'food', 'idea')),
  title text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.wishlist_shares (
  item_id uuid not null references public.wishlist_items (id) on delete cascade,
  shared_with uuid not null references public.profiles (id) on delete cascade,
  primary key (item_id, shared_with)
);

create table public.plans_future (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wish_id uuid references public.wishlist_items (id) on delete set null,
  title text not null,
  meet_at timestamptz not null,
  place text not null,
  created_at timestamptz not null default now()
);

create table public.plan_invites (
  plan_id uuid not null references public.plans_future (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  primary key (plan_id, invitee_id)
);

-- ---------------------------------------------------------------------------
-- Later phases: tables exist now so RLS is never added as an afterthought.
-- The app still uses mock data for these until the phase named in the comment.
-- ---------------------------------------------------------------------------

-- Phase 4
create table public.match_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  food text not null,
  tone text not null,
  city text not null,
  area text,
  lat numeric(8, 2),
  lng numeric(8, 2),
  status text not null default 'open' check (status in ('open', 'matched', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index match_requests_lookup_idx on public.match_requests (food, city, status, created_at desc);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  food text not null,
  status text not null default 'pending' check (status in ('pending', 'live', 'ended', 'skipped')),
  created_at timestamptz not null default now()
);

-- Phase 5
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  rating integer check (rating between 1 and 5),
  tags text[] not null default '{}',
  body text,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'story', 'meeting')),
  target_id text not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);

-- Phase 6
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  storage_path text not null,
  caption text,
  hidden boolean not null default false,
  views integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table public.user_avatar_inventory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  item_id text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, category, item_id),
  foreign key (category, item_id) references public.avatar_items (category, id)
);

create table public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_count integer not null default 0,
  month date not null,
  updated_at timestamptz not null default now()
);

create table public.streak_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('meeting_completed', 'join_accepted')),
  at timestamptz not null default now()
);

create table public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id text not null references public.rewards (id),
  claimed_at timestamptz not null default now(),
  unique (user_id, reward_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  display text;
begin
  base := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'foodie'), '[^a-z0-9._]', '', 'g'));
  if base = '' then
    base := 'foodie';
  end if;
  display := coalesce(nullif(new.raw_user_meta_data->>'name', ''), initcap(base));
  insert into public.profiles (id, name, handle)
  values (new.id, display, base || '-' || substr(new.id::text, 1, 4));
  return new;
exception
  when unique_violation then
    insert into public.profiles (id, name, handle)
    values (new.id, display, base || '-' || substr(replace(new.id::text, '-', ''), 1, 8));
    return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Phase 2 stand-in for Razorpay. Phase 3 revokes this and writes subscriptions from the webhook only.
create or replace function public.activate_mock_plan(p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_plan not in ('plus', 'premium', 'ultra') then
    raise exception 'Unknown plan';
  end if;
  update public.subscriptions
    set status = 'cancelled'
    where user_id = auth.uid() and status = 'active' and provider = 'mock';
  insert into public.subscriptions (user_id, plan_id, status, provider)
  values (auth.uid(), p_plan, 'active', 'mock');
  update public.profiles
    set plan_id = p_plan, plan_since = now()
    where id = auth.uid();
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.activate_mock_plan(text) from public, anon;
revoke all on function public.delete_own_account() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.activate_mock_plan(text) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.plans, public.avatar_items, public.music_tracks, public.sponsors, public.rewards to anon, authenticated;

grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated, anon;
grant update (
  name, handle, bio, city, area, tone, food_interests, avatar, notifications_enabled
) on public.profiles to authenticated;

grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert on public.consents to authenticated;
grant select on public.subscriptions, public.payments to authenticated;

grant select, insert, delete on public.follows to authenticated;
grant select, insert, update, delete on public.connections to authenticated;
grant select, insert, delete on public.blocks, public.mutes to authenticated;

grant select, insert, update, delete on public.wishlist_items to authenticated;
grant select, insert, delete on public.wishlist_shares to authenticated;
grant select, insert, delete on public.plans_future to authenticated;
grant select, insert on public.plan_invites to authenticated;

grant select, insert, update, delete on public.match_requests to authenticated;
grant select on public.matches, public.meetings to authenticated;
grant select, insert on public.feedback, public.reports to authenticated;
grant select, insert, delete on public.stories to authenticated;
grant select, insert on public.story_views to authenticated;
grant select, insert, delete on public.user_avatar_inventory to authenticated;
grant select, insert on public.streaks, public.streak_events, public.user_rewards to authenticated;
grant select, update on public.notifications to authenticated;

alter table public.plans enable row level security;
alter table public.avatar_items enable row level security;
alter table public.music_tracks enable row level security;
alter table public.sponsors enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_codes enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.consents enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.follows enable row level security;
alter table public.connections enable row level security;
alter table public.blocks enable row level security;
alter table public.mutes enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.wishlist_shares enable row level security;
alter table public.plans_future enable row level security;
alter table public.plan_invites enable row level security;
alter table public.match_requests enable row level security;
alter table public.matches enable row level security;
alter table public.meetings enable row level security;
alter table public.feedback enable row level security;
alter table public.reports enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.user_avatar_inventory enable row level security;
alter table public.streaks enable row level security;
alter table public.streak_events enable row level security;
alter table public.user_rewards enable row level security;
alter table public.notifications enable row level security;

-- Catalog: anyone can read. No write policies, so clients cannot change prices or rewards.
create policy "plans are public" on public.plans for select using (true);
create policy "avatar items are public" on public.avatar_items for select using (true);
create policy "tracks are public" on public.music_tracks for select using (true);
create policy "sponsors are public" on public.sponsors for select using (true);
create policy "rewards are public" on public.rewards for select using (true);
-- reward_codes: RLS on, no policy. Default deny for anon and authenticated.

create policy "profiles are visible to signed-in users" on public.profiles
  for select to authenticated
  using (not suspended or id = auth.uid());

create policy "edit your own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "preferences are private" on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "read your consents" on public.consents
  for select to authenticated using (user_id = auth.uid());
create policy "record your consent" on public.consents
  for insert to authenticated with check (user_id = auth.uid() and adult and respectful);

create policy "read your subscriptions" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "read your payments" on public.payments
  for select to authenticated using (user_id = auth.uid());

create policy "follows are visible" on public.follows
  for select to authenticated using (true);
create policy "follow as yourself" on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
create policy "unfollow as yourself" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

create policy "see your connections" on public.connections
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "send a connection request" on public.connections
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy "cancel your own request" on public.connections
  for delete to authenticated
  using (requester_id = auth.uid() and status = 'pending');
create policy "answer or keep your request" on public.connections
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (
    (addressee_id = auth.uid() and status in ('accepted', 'rejected'))
    or (requester_id = auth.uid() and status = 'pending')
  );

create policy "see who you blocked" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "block as yourself" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "unblock as yourself" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

create policy "see your mutes" on public.mutes
  for select to authenticated using (user_id = auth.uid());
create policy "mute as yourself" on public.mutes
  for insert to authenticated with check (user_id = auth.uid());
create policy "unmute as yourself" on public.mutes
  for delete to authenticated using (user_id = auth.uid());

create policy "see your wishes and ones shared with you" on public.wishlist_items
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.wishlist_shares s where s.item_id = id and s.shared_with = auth.uid())
  );
create policy "add your wishes" on public.wishlist_items
  for insert to authenticated with check (user_id = auth.uid());
create policy "edit your wishes" on public.wishlist_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete your wishes" on public.wishlist_items
  for delete to authenticated using (user_id = auth.uid());

create policy "see shares you made or received" on public.wishlist_shares
  for select to authenticated
  using (
    shared_with = auth.uid()
    or exists (select 1 from public.wishlist_items w where w.id = item_id and w.user_id = auth.uid())
  );
create policy "share your own wish" on public.wishlist_shares
  for insert to authenticated
  with check (exists (select 1 from public.wishlist_items w where w.id = item_id and w.user_id = auth.uid()));
create policy "unshare your own wish" on public.wishlist_shares
  for delete to authenticated
  using (exists (select 1 from public.wishlist_items w where w.id = item_id and w.user_id = auth.uid()));

create policy "see plans you own or were invited to" on public.plans_future
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.plan_invites i where i.plan_id = id and i.invitee_id = auth.uid())
  );
create policy "create your plans" on public.plans_future
  for insert to authenticated with check (user_id = auth.uid());
create policy "delete your plans" on public.plans_future
  for delete to authenticated using (user_id = auth.uid());

create policy "see your invites" on public.plan_invites
  for select to authenticated
  using (
    invitee_id = auth.uid()
    or exists (select 1 from public.plans_future p where p.id = plan_id and p.user_id = auth.uid())
  );
create policy "invite to your plan" on public.plan_invites
  for insert to authenticated
  with check (exists (select 1 from public.plans_future p where p.id = plan_id and p.user_id = auth.uid()));

-- Phase 4+: owner-only until those features are wired. Stops a client from reading other people's requests.
create policy "your match requests" on public.match_requests
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "your matches" on public.matches
  for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());
create policy "your meetings" on public.meetings
  for select to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid())
  ));
create policy "your feedback" on public.feedback
  for select to authenticated using (author_id = auth.uid());
create policy "write your feedback" on public.feedback
  for insert to authenticated with check (author_id = auth.uid());
create policy "your reports" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "file a report" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

create policy "visible stories" on public.stories
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      not hidden
      and created_at > now() - interval '24 hours'
      and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = user_id)
      and not exists (select 1 from public.blocks b where b.blocker_id = user_id and b.blocked_id = auth.uid())
    )
  );
create policy "post your story" on public.stories
  for insert to authenticated with check (user_id = auth.uid());
create policy "delete your story" on public.stories
  for delete to authenticated using (user_id = auth.uid());

create policy "story views" on public.story_views
  for select to authenticated
  using (viewer_id = auth.uid() or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));
create policy "mark a story seen" on public.story_views
  for insert to authenticated with check (viewer_id = auth.uid());

create policy "your avatar inventory" on public.user_avatar_inventory
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "your streak" on public.streaks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "your streak events" on public.streak_events
  for select to authenticated using (user_id = auth.uid());
create policy "add your streak events" on public.streak_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "your claimed rewards" on public.user_rewards
  for select to authenticated using (user_id = auth.uid());
create policy "claim a reward" on public.user_rewards
  for insert to authenticated with check (user_id = auth.uid());
create policy "your notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "mark your notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
