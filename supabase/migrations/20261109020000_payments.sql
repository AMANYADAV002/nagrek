-- Phase 3: Razorpay payments, plan expiry, paid avatar items, and tightened grants.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Supabase grants every new table to anon and authenticated by default, which
-- left RLS as the only barrier. Reset to exactly what the app uses.

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant select on public.plans, public.avatar_items, public.music_tracks, public.sponsors, public.rewards to anon, authenticated;

grant select on public.profiles to authenticated;
-- No plan, role, onboarding or avatar columns: those change through checked functions only.
grant update (name, handle, bio, city, area, tone, food_interests, notifications_enabled) on public.profiles to authenticated;

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
-- Bought items are granted by fulfill_payment(); streak counts come from the server (phase 6).
grant select on public.user_avatar_inventory, public.streaks to authenticated;
-- TODO(phase-6): move streak events and reward claims behind server-side checks.
grant select, insert on public.streak_events, public.user_rewards to authenticated;
grant select, update on public.notifications to authenticated;

drop policy "your avatar inventory" on public.user_avatar_inventory;
create policy "read your avatar inventory" on public.user_avatar_inventory
  for select to authenticated using (user_id = auth.uid());
drop policy "your streak" on public.streaks;
create policy "read your streak" on public.streaks
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Plan expiry and payment records
-- ---------------------------------------------------------------------------

alter table public.profiles add column plan_expires_at timestamptz;

alter table public.payments
  add column provider text not null default 'razorpay' check (provider in ('razorpay', 'mock')),
  add column provider_payment_id text,
  add column plan_id text references public.plans (id),
  add column item_category text,
  add column item_id text,
  add column paid_at timestamptz,
  add constraint payments_status_check check (status in ('created', 'paid', 'failed')),
  add constraint payments_purpose_check check (
    (purpose = 'plan' and plan_id is not null)
    or (purpose = 'avatar_item' and item_category is not null and item_id is not null)
  );
create unique index payments_provider_ref_key on public.payments (provider_ref);

alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check check (provider in ('razorpay', 'mock'));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

drop function if exists public.activate_mock_plan(text);

-- 30 days per payment. Paying again for the same active plan extends it; switching plans starts fresh.
create or replace function public.grant_plan(p_user uuid, p_plan text, p_provider text, p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur record;
  base timestamptz;
begin
  select plan_id, plan_since, plan_expires_at into cur from public.profiles where id = p_user for update;
  base := case when cur.plan_id = p_plan and cur.plan_expires_at > now() then cur.plan_expires_at else now() end;

  update public.subscriptions set status = 'cancelled' where user_id = p_user and status = 'active';
  insert into public.subscriptions (user_id, plan_id, status, provider, provider_ref, current_period_end)
  values (p_user, p_plan, 'active', p_provider, p_ref, base + interval '30 days');

  update public.profiles
    set plan_id = p_plan,
        plan_since = case when cur.plan_id = p_plan and cur.plan_expires_at > now() then cur.plan_since else now() end,
        plan_expires_at = base + interval '30 days'
    where id = p_user;
end;
$$;

-- Idempotent: Razorpay may confirm the same order through the browser and the webhook.
create or replace function public.fulfill_payment(p_order_id text, p_payment_id text, p_amount_paise integer default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments;
begin
  select * into pay from public.payments where provider_ref = p_order_id for update;
  if not found then
    raise exception 'Unknown order %', p_order_id;
  end if;
  if pay.status = 'paid' then
    return 'already_paid';
  end if;
  if p_amount_paise is not null and p_amount_paise <> pay.amount_inr * 100 then
    raise exception 'Amount mismatch for order %', p_order_id;
  end if;

  update public.payments
    set status = 'paid', provider_payment_id = p_payment_id, paid_at = now()
    where id = pay.id;

  if pay.purpose = 'plan' then
    perform public.grant_plan(pay.user_id, pay.plan_id, pay.provider, p_payment_id);
  else
    insert into public.user_avatar_inventory (user_id, category, item_id)
    values (pay.user_id, pay.item_category, pay.item_id)
    on conflict do nothing;
  end if;
  return 'paid';
end;
$$;

-- Validates every layer before saving: the item exists, and is free, bought, or unlocked.
create or replace function public.save_avatar(p_avatar jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cats constant text[] := array['skin', 'hair', 'hairColor', 'outfit', 'accessory', 'background'];
  cat text;
  val text;
  item public.avatar_items;
  prof record;
  streak_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if jsonb_typeof(p_avatar) is distinct from 'object' then
    raise exception 'Invalid avatar';
  end if;

  select plan_id, plan_expires_at into prof from public.profiles where id = auth.uid();
  select current_count into streak_count from public.streaks where user_id = auth.uid();

  foreach cat in array cats loop
    val := p_avatar ->> cat;
    select * into item from public.avatar_items where category = cat and id = val;
    if not found then
      raise exception 'Unknown avatar item %:%', cat, val;
    end if;
    if item.unlock_type = 'plan'
       and not (prof.plan_id = item.unlock_value and prof.plan_expires_at > now()) then
      raise exception '% needs the % plan', item.label, item.unlock_value;
    end if;
    if item.unlock_type = 'streak' and coalesce(streak_count, 0) < item.unlock_value::integer then
      raise exception '% needs a %-day streak', item.label, item.unlock_value;
    end if;
    if item.unlock_type is null and item.price_inr > 0 and not exists (
      select 1 from public.user_avatar_inventory
      where user_id = auth.uid() and category = cat and item_id = val
    ) then
      raise exception '% has not been bought', item.label;
    end if;
  end loop;

  update public.profiles
    set avatar = (select jsonb_object_agg(c, p_avatar ->> c) from unnest(cats) as c)
    where id = auth.uid();
end;
$$;

revoke all on function public.grant_plan(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.fulfill_payment(text, text, integer) from public, anon, authenticated;
grant execute on function public.fulfill_payment(text, text, integer) to service_role;
revoke all on function public.save_avatar(jsonb) from public, anon;
grant execute on function public.save_avatar(jsonb) to authenticated;
