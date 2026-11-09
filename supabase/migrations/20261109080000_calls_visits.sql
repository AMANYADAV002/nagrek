-- Numberless voice/video calls between connections, planned in-person visits,
-- and a visit streak that only grows when both people prove they met
-- (each scans the other's rotating QR code while both phones report nearby GPS fixes).

-- ---------------------------------------------------------------------------
-- Calls. People are addressed only by their app user id; no phone numbers exist anywhere.
-- ---------------------------------------------------------------------------

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles (id) on delete cascade,
  callee_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('voice', 'video')),
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'declined', 'missed', 'cancelled', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  constraint no_self_call check (caller_id <> callee_id)
);
create index calls_callee_idx on public.calls (callee_id, created_at desc);
create index calls_caller_idx on public.calls (caller_id, created_at desc);

-- Read-only for the two participants (incoming-call alerts use Realtime on this table).
-- Every write goes through server actions that check connections, blocks and rate limits.
alter table public.calls enable row level security;
create policy "see your calls" on public.calls
  for select to authenticated
  using ((select auth.uid()) in (caller_id, callee_id));
grant select on public.calls to authenticated;
alter publication supabase_realtime add table public.calls;

-- WebRTC signalling for calls runs on the private Realtime channel `call:<call id>`.
create policy "call participants listen" on realtime.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.calls c
      where (select realtime.topic()) = 'call:' || c.id::text
        and c.status in ('ringing', 'accepted')
        and (select auth.uid()) in (c.caller_id, c.callee_id)
    )
  );

create policy "call participants signal" on realtime.messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.calls c
      where (select realtime.topic()) = 'call:' || c.id::text
        and c.status in ('ringing', 'accepted')
        and (select auth.uid()) in (c.caller_id, c.callee_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Planned visits
-- ---------------------------------------------------------------------------

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  call_id uuid references public.calls (id) on delete set null,
  place_name text not null check (char_length(place_name) between 2 and 120),
  place_area text check (char_length(place_area) <= 120),
  note text check (char_length(note) <= 300),
  scheduled_at timestamptz not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'declined', 'cancelled', 'verified', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  verified_at timestamptz,
  constraint no_self_visit check (proposer_id <> invitee_id)
);
create index visits_proposer_idx on public.visits (proposer_id, scheduled_at desc);
create index visits_invitee_idx on public.visits (invitee_id, scheduled_at desc);

alter table public.visits enable row level security;
create policy "see your visits" on public.visits
  for select to authenticated
  using ((select auth.uid()) in (proposer_id, invitee_id));
grant select on public.visits to authenticated;

-- ---------------------------------------------------------------------------
-- Verification state. Server-only: RLS on, no policies, no grants.
-- ---------------------------------------------------------------------------

-- One rotating QR code. Only the SHA-256 of the token is stored; the GPS fix of the person
-- showing it is kept until the visit is verified, then deleted.
create table public.visit_tokens (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real not null,
  fixed_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index visit_tokens_visit_idx on public.visit_tokens (visit_id);
alter table public.visit_tokens enable row level security;

-- A successful scan in one direction. Both directions within 10 minutes verify the visit.
-- Only the distance is kept, never the coordinates.
create table public.visit_scans (
  visit_id uuid not null references public.visits (id) on delete cascade,
  scanner_id uuid not null references public.profiles (id) on delete cascade,
  shower_id uuid not null references public.profiles (id) on delete cascade,
  distance_m real not null,
  scanned_at timestamptz not null default now(),
  primary key (visit_id, scanner_id)
);
alter table public.visit_scans enable row level security;

-- Last fix per person, rounded to ~110 m, for the impossible-travel check.
create table public.visit_last_fix (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  fixed_at timestamptz not null
);
alter table public.visit_last_fix enable row level security;

-- Visits that counted toward someone's streak (used for the anti-farming limits).
create table public.visit_streak_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (user_id, visit_id)
);
create index visit_streak_events_recent_idx on public.visit_streak_events (user_id, at desc);
alter table public.visit_streak_events enable row level security;

-- ---------------------------------------------------------------------------
-- Visit streak. Readable by its owner; written only by count_visit().
-- ---------------------------------------------------------------------------

create table public.visit_streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_count integer not null default 0,
  best_count integer not null default 0,
  total_verified integer not null default 0,
  last_counted_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.visit_streaks enable row level security;
create policy "see your visit streak" on public.visit_streaks
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.visit_streaks to authenticated;

-- ---------------------------------------------------------------------------
-- Sponsor rewards now unlock on verified visits.
-- ---------------------------------------------------------------------------

alter table public.rewards add column min_visits integer not null default 1 check (min_visits > 0);
update public.rewards
set min_visits = case min_streak when 3 then 1 when 7 then 3 when 15 then 5 when 30 then 10 else greatest(1, min_streak / 3) end;

-- ---------------------------------------------------------------------------
-- Functions (service role only, except the pure distance helper)
-- ---------------------------------------------------------------------------

create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- A streak lapses after 30 days without a counted visit.
create or replace function public.effective_visit_streak(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when last_counted_at >= now() - interval '30 days' then current_count else 0 end
     from public.visit_streaks where user_id = p_user),
    0)
$$;

-- Rejects fixes that are imprecise, stale, or physically impossible after the person's previous fix.
create or replace function public.visit_check_fix(p_user uuid, p_lat double precision, p_lng double precision, p_acc real, p_fixed_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last public.visit_last_fix;
  v_dist double precision;
  v_secs double precision;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'bad_location';
  end if;
  if p_acc is null or p_acc <= 0 or p_acc > 100 then raise exception 'weak_gps'; end if;
  if p_fixed_at is null or p_fixed_at < now() - interval '2 minutes' or p_fixed_at > now() + interval '30 seconds' then
    raise exception 'stale_gps';
  end if;

  select * into v_last from public.visit_last_fix where user_id = p_user;
  if found then
    v_dist := public.geo_distance_m(v_last.lat, v_last.lng, p_lat, p_lng);
    v_secs := greatest(extract(epoch from (p_fixed_at - v_last.fixed_at)), 1);
    -- Faster than 300 km/h over more than 5 km: a spoofed or teleported location.
    if v_dist > 5000 and v_dist / v_secs > 83 then raise exception 'impossible_travel'; end if;
  end if;

  insert into public.visit_last_fix (user_id, lat, lng, fixed_at)
  values (p_user, round(p_lat::numeric, 3), round(p_lng::numeric, 3), p_fixed_at)
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, fixed_at = excluded.fixed_at;
end;
$$;

-- Stores a new QR token for the person showing their code. Tokens live 45 seconds.
create or replace function public.issue_visit_token(
  p_visit uuid, p_user uuid, p_token_hash text,
  p_lat double precision, p_lng double precision, p_acc real, p_fixed_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visits;
  v_expires timestamptz := now() + interval '45 seconds';
begin
  select * into v from public.visits where id = p_visit;
  if not found or p_user not in (v.proposer_id, v.invitee_id) then raise exception 'visit_not_found'; end if;
  if v.status = 'verified' then raise exception 'already_verified'; end if;
  if v.status <> 'accepted' then raise exception 'not_accepted'; end if;
  if now() not between v.scheduled_at - interval '2 hours' and v.scheduled_at + interval '6 hours' then
    raise exception 'outside_window';
  end if;

  perform public.visit_check_fix(p_user, p_lat, p_lng, p_acc, p_fixed_at);
  delete from public.visit_tokens where expires_at < now() - interval '1 day';
  insert into public.visit_tokens (visit_id, user_id, token_hash, lat, lng, accuracy_m, fixed_at, expires_at)
  values (p_visit, p_user, p_token_hash, p_lat, p_lng, p_acc, p_fixed_at, v_expires);
  return v_expires;
end;
$$;

-- Counts a verified visit for one person and hands out any rewards they now qualify for.
create or replace function public.count_visit(p_user uuid, p_partner uuid, p_visit uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
  v_count integer;
  v_rewards text[] := '{}';
  v_today timestamptz := ((now() at time zone 'Asia/Kolkata')::date)::timestamp at time zone 'Asia/Kolkata';
  r record;
begin
  -- Anti-farming: one counted visit per pair per 7 days, at most two counted visits per day.
  if exists (
    select 1 from public.visit_streak_events
    where user_id = p_user and partner_id = p_partner and at > now() - interval '7 days'
  ) then
    v_reason := 'same_partner_this_week';
  elsif (select count(*) from public.visit_streak_events where user_id = p_user and at >= v_today) >= 2 then
    v_reason := 'daily_limit';
  end if;

  if v_reason is null then
    v_count := public.effective_visit_streak(p_user) + 1;
    insert into public.visit_streak_events (user_id, visit_id, partner_id) values (p_user, p_visit, p_partner);
    insert into public.visit_streaks (user_id, current_count, best_count, total_verified, last_counted_at, updated_at)
    values (p_user, v_count, v_count, 1, now(), now())
    on conflict (user_id) do update
      set current_count = v_count,
          best_count = greatest(visit_streaks.best_count, v_count),
          total_verified = visit_streaks.total_verified + 1,
          last_counted_at = now(),
          updated_at = now();
  else
    v_count := public.effective_visit_streak(p_user);
    insert into public.visit_streaks (user_id, total_verified, updated_at)
    values (p_user, 1, now())
    on conflict (user_id) do update
      set total_verified = visit_streaks.total_verified + 1, updated_at = now();
  end if;

  for r in
    select w.id from public.rewards w
    where w.min_visits <= v_count
      and w.stock > 0
      and w.expires_at >= (now() at time zone 'Asia/Kolkata')::date
      and not exists (select 1 from public.user_rewards u where u.user_id = p_user and u.reward_id = w.id)
    order by w.min_visits
  loop
    begin
      perform public.claim_reward(p_user, r.id);
      v_rewards := v_rewards || r.id;
    exception when others then
      null; -- plan too low or stock ran out: the person can still claim later.
    end;
  end loop;

  return jsonb_build_object('user', p_user, 'counted', v_reason is null, 'reason', v_reason, 'streak', v_count, 'rewards', to_jsonb(v_rewards));
end;
$$;

-- One person scans the other's QR code. When both have scanned, the visit is verified and
-- both streaks are updated in the same transaction.
create or replace function public.record_visit_scan(
  p_visit uuid, p_scanner uuid, p_token_hash text,
  p_lat double precision, p_lng double precision, p_acc real, p_fixed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visits;
  t public.visit_tokens;
  v_partner uuid;
  v_dist double precision;
  v_other timestamptz;
begin
  -- Row lock: simultaneous scans by both people are processed one after the other.
  select * into v from public.visits where id = p_visit for update;
  if not found or p_scanner not in (v.proposer_id, v.invitee_id) then raise exception 'visit_not_found'; end if;
  if v.status = 'verified' then return jsonb_build_object('state', 'verified', 'results', '[]'::jsonb); end if;
  if v.status <> 'accepted' then raise exception 'not_accepted'; end if;
  if now() not between v.scheduled_at - interval '2 hours' and v.scheduled_at + interval '6 hours' then
    raise exception 'outside_window';
  end if;
  v_partner := case when p_scanner = v.proposer_id then v.invitee_id else v.proposer_id end;

  -- Single use: a token can be consumed once, and only before it expires.
  update public.visit_tokens set used_at = now()
  where token_hash = p_token_hash and visit_id = p_visit and used_at is null and expires_at > now()
  returning * into t;
  if not found then raise exception 'bad_token'; end if;
  if t.user_id <> v_partner then raise exception 'own_code'; end if;

  perform public.visit_check_fix(p_scanner, p_lat, p_lng, p_acc, p_fixed_at);
  if abs(extract(epoch from (p_fixed_at - t.fixed_at))) > 180 then raise exception 'stale_gps'; end if;
  v_dist := public.geo_distance_m(t.lat, t.lng, p_lat, p_lng);
  if v_dist > least(150, 30 + t.accuracy_m + p_acc) then raise exception 'too_far'; end if;

  insert into public.visit_scans (visit_id, scanner_id, shower_id, distance_m)
  values (p_visit, p_scanner, v_partner, v_dist)
  on conflict (visit_id, scanner_id) do update set distance_m = excluded.distance_m, scanned_at = now();

  select scanned_at into v_other from public.visit_scans where visit_id = p_visit and scanner_id = v_partner;
  if v_other is null or v_other < now() - interval '10 minutes' then
    return jsonb_build_object('state', 'waiting_for_partner');
  end if;

  update public.visits set status = 'verified', verified_at = now() where id = p_visit;
  delete from public.visit_tokens where visit_id = p_visit;
  return jsonb_build_object(
    'state', 'verified',
    'results', jsonb_build_array(
      public.count_visit(v.proposer_id, v.invitee_id, p_visit),
      public.count_visit(v.invitee_id, v.proposer_id, p_visit)
    )
  );
end;
$$;

-- Rewards unlock on the visit streak instead of the call-day streak.
create or replace function public.claim_reward(p_user uuid, p_reward text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.rewards;
  v_profile public.profiles;
  v_code public.reward_codes;
  v_rank_have integer;
  v_rank_need integer;
begin
  select * into v_reward from public.rewards where id = p_reward for update;
  if not found then raise exception 'reward_not_found'; end if;
  if v_reward.expires_at < (now() at time zone 'Asia/Kolkata')::date then raise exception 'expired'; end if;
  if exists (select 1 from public.user_rewards where user_id = p_user and reward_id = p_reward) then
    raise exception 'already_claimed';
  end if;

  select * into v_profile from public.profiles where id = p_user;
  if not found or v_profile.suspended then raise exception 'not_allowed'; end if;
  if v_profile.plan_id is null or v_profile.plan_expires_at is null or v_profile.plan_expires_at < now() then
    raise exception 'plan';
  end if;
  select rank into v_rank_have from public.plans where id = v_profile.plan_id;
  select rank into v_rank_need from public.plans where id = v_reward.min_plan;
  if v_rank_have < v_rank_need then raise exception 'plan'; end if;

  if public.effective_visit_streak(p_user) < v_reward.min_visits then raise exception 'visits'; end if;

  select * into v_code from public.reward_codes
    where reward_id = p_reward and claimed_at is null
    limit 1
    for update skip locked;
  if not found or v_reward.stock <= 0 then raise exception 'out_of_stock'; end if;

  update public.reward_codes set claimed_by = p_user, claimed_at = now() where id = v_code.id;
  update public.rewards set stock = stock - 1 where id = p_reward;
  insert into public.user_rewards (user_id, reward_id, code_id) values (p_user, p_reward, v_code.id);
  return v_code.code;
end;
$$;

revoke all on function public.effective_visit_streak(uuid) from public, anon, authenticated;
revoke all on function public.visit_check_fix(uuid, double precision, double precision, real, timestamptz) from public, anon, authenticated;
revoke all on function public.issue_visit_token(uuid, uuid, text, double precision, double precision, real, timestamptz) from public, anon, authenticated;
revoke all on function public.count_visit(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_visit_scan(uuid, uuid, text, double precision, double precision, real, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.effective_visit_streak(uuid) to service_role;
grant execute on function public.visit_check_fix(uuid, double precision, double precision, real, timestamptz) to service_role;
grant execute on function public.issue_visit_token(uuid, uuid, text, double precision, double precision, real, timestamptz) to service_role;
grant execute on function public.count_visit(uuid, uuid, uuid) to service_role;
grant execute on function public.record_visit_scan(uuid, uuid, text, double precision, double precision, real, timestamptz) to service_role;
grant execute on function public.claim_reward(uuid, text) to service_role;
