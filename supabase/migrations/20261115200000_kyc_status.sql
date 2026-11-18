-- Owner-readable KYC status for Realtime. No sealed proof or identity columns.
-- Run this in the Supabase SQL editor after 20261115183000_kyc_vault.sql.
-- Do not change policies on older tables.

create table public.kyc_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'verified', 'rejected')),
  updated_at timestamptz not null default now()
);

alter table public.kyc_status enable row level security;
alter table public.kyc_status force row level security;
revoke all on public.kyc_status from public, anon;
grant select on public.kyc_status to authenticated;

create policy kyc_status_select_own
  on public.kyc_status
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.kyc_status;
