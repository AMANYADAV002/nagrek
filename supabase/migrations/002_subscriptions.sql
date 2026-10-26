-- =============================================================
-- Nagrek · Phase 2 · Subscriptions & Payment Events
-- =============================================================

-- 1. Subscriptions Table
create table if not exists public.subscriptions (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  razorpay_subscription_id  text unique,
  plan                      text not null, -- 'trial' | 'm1' | 'm3' | 'm6'
  status                    text not null check (status in ('trial', 'active', 'halted', 'cancelled', 'expired')),
  current_period_end        timestamptz,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

comment on table public.subscriptions is 'User subscription status updated exclusively by verified webhooks.';

-- Row Level Security
alter table public.subscriptions enable row level security;

-- Users can read their own subscription row
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using ( auth.uid() = user_id );

-- Write access: SERVICE ROLE ONLY (no client insert/update/delete policies)

-- 2. Payment Events Table (Idempotent Webhook Audit Log)
create table if not exists public.payment_events (
  event_id    text primary key,
  type        text not null,
  payload     jsonb not null,
  received_at timestamptz default now()
);

comment on table public.payment_events is 'Log of processed Razorpay webhooks for idempotency and audit.';

-- Row Level Security: SERVICE ROLE ONLY
alter table public.payment_events enable row level security;
-- No client policies created; only the backend service role key can access.
