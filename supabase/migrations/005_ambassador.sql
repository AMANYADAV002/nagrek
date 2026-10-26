-- =============================================================
-- Nagrek · Growth · campus ambassadors
-- Apply after GATE-G1.
-- =============================================================

create table if not exists public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  campus text not null,
  city text,
  note text,
  created_at timestamptz default now(),
  constraint ambassadors_email_unique unique (email)
);

alter table public.ambassadors enable row level security;
-- Inserts via service-role API only.
