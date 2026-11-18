-- Zero-storage KYC. Run this in the Supabase SQL editor after Vault is enabled.
-- Stores a verification result and a sealed status token. Do not add columns for
-- identity numbers, card files, or addresses.
-- Create the encryption secret yourself (do not commit it):
--   select vault.create_secret('<long random secret>', 'kyc_token_key');

create table public.kyc_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  provider text not null check (char_length(provider) between 2 and 40),
  reference_hash text check (reference_hash is null or reference_hash ~ '^[a-f0-9]{64}$'),
  token_iv text,
  token_tag text,
  token_ciphertext text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_has_proof check (
    status <> 'verified'
    or (reference_hash is not null and token_ciphertext is not null and verified_at is not null)
  )
);

alter table public.kyc_verifications enable row level security;
alter table public.kyc_verifications force row level security;
revoke all on public.kyc_verifications from public, anon, authenticated;

create table public.kyc_audit_logs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (action in ('initiate', 'verified', 'rejected')),
  target_user_id uuid not null,
  ip text
);

alter table public.kyc_audit_logs enable row level security;
alter table public.kyc_audit_logs force row level security;
revoke all on public.kyc_audit_logs from public, anon, authenticated;

create or replace function public.kyc_audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'kyc_audit_logs is append-only';
end;
$$;

create trigger kyc_audit_no_change
  before update or delete on public.kyc_audit_logs
  for each row execute function public.kyc_audit_immutable();

create trigger kyc_audit_no_truncate
  before truncate on public.kyc_audit_logs
  for each statement execute function public.kyc_audit_immutable();

revoke all on function public.kyc_audit_immutable() from public, anon, authenticated;

-- Reads the Vault secret named kyc_token_key. Service role only.
create or replace function public.kyc_read_token_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'kyc_token_key' limit 1;
$$;

revoke all on function public.kyc_read_token_key() from public, anon, authenticated;
grant execute on function public.kyc_read_token_key() to service_role;

-- Public matching columns only. Date of birth, email, plan, and KYC stay off this view.
create or replace view public.profiles_public
with (security_invoker = true) as
select id, name, handle, bio, city, area, avatar, tone, food_interests
from public.profiles
where suspended = false and onboarded_at is not null;

grant select on public.profiles_public to authenticated;
