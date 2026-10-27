-- =============================================================
-- Nagrek · social handles for friends (shown after mutual accept)
-- Apply after GATE-G1.
-- =============================================================

alter table public.profiles
  add column if not exists instagram text,
  add column if not exists snapchat text,
  add column if not exists facebook text,
  add column if not exists linkedin text;

comment on column public.profiles.instagram is 'Optional Instagram handle (no @ required)';
comment on column public.profiles.snapchat is 'Optional Snapchat username';
comment on column public.profiles.facebook is 'Optional Facebook profile URL or username';
comment on column public.profiles.linkedin is 'Optional LinkedIn URL or username';
