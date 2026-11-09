-- Phase 7: moderation audit log. Written only by the server after it checks profiles.role = 'admin'.

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete set null,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('dismissed', 'content_hidden', 'user_warned', 'user_suspended', 'user_restored')),
  target_type text not null check (target_type in ('user', 'story', 'meeting')),
  target_id text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.moderation_actions enable row level security;
-- No client policies and no grants: service role only.

create index reports_open_idx on public.reports (created_at desc) where status = 'open';

-- To make someone an admin, run in the SQL editor:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
