-- Phase 6: stories in private Storage, server-issued reward codes, opt-in leaderboard,
-- story consent between meeting partners.

-- ---------------------------------------------------------------------------
-- Stories
-- ---------------------------------------------------------------------------

-- Private bucket. Files are read only through short-lived signed URLs made on the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stories', 'stories', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- People upload into their own folder (<user id>/<file>) and can delete their own files.
-- No select policy: nobody lists or downloads directly.
create policy "upload into your story folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete your story files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);

-- Story rows are written by the server after it checks the uploaded file and the daily limit.
revoke insert on public.stories from authenticated;
drop policy "post your story" on public.stories;

alter table public.stories add column match_id uuid references public.matches (id) on delete set null;
create index stories_recent_idx on public.stories (created_at desc) where not hidden;

-- ---------------------------------------------------------------------------
-- Reward codes
-- ---------------------------------------------------------------------------

alter table public.user_rewards add column code_id uuid references public.reward_codes (id);

-- Deleting an account must not fail because of a claimed code. claimed_at stays set, so the
-- code is never handed out again.
alter table public.reward_codes drop constraint reward_codes_claimed_by_fkey;
alter table public.reward_codes
  add constraint reward_codes_claimed_by_fkey foreign key (claimed_by) references public.profiles (id) on delete set null;
revoke insert on public.user_rewards from authenticated;
drop policy "claim a reward" on public.user_rewards;

-- Hands out one unused code atomically. Codes never pass through the browser except the
-- caller's own claimed code, returned by this function to the server.
create or replace function public.claim_reward(p_user uuid, p_reward text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.rewards;
  v_profile public.profiles;
  v_streak integer;
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

  select current_count into v_streak from public.streaks where user_id = p_user;
  if coalesce(v_streak, 0) < v_reward.min_streak then raise exception 'streak'; end if;

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

revoke all on function public.claim_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_reward(uuid, text) to service_role;

-- Placeholder codes until real sponsors sign up. Clearly marked so nobody mistakes them for real offers.
insert into public.reward_codes (reward_id, code)
select r.id, 'NAGREK-DEMO-' || upper(encode(gen_random_bytes(4), 'hex'))
from public.rewards r
cross join generate_series(1, 25)
on conflict (reward_id, code) do nothing;

-- Stock shown in the app equals the codes actually available.
update public.rewards r
set stock = (select count(*) from public.reward_codes c where c.reward_id = r.id and c.claimed_at is null);

-- ---------------------------------------------------------------------------
-- Leaderboard (opt-in) and story consent
-- ---------------------------------------------------------------------------

alter table public.profiles add column show_on_leaderboard boolean not null default false;
grant update (show_on_leaderboard) on public.profiles to authenticated;

-- One row per meeting: both people must agree before either can post it as a story.
create table public.story_consents (
  match_id uuid not null references public.matches (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'granted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (match_id, requester_id)
);
alter table public.story_consents enable row level security;
create policy "your story consents" on public.story_consents
  for select to authenticated
  using (requester_id = auth.uid() or partner_id = auth.uid());
grant select on public.story_consents to authenticated;
