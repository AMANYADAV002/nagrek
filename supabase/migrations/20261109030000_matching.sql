-- Phase 4: live matching, join pings, notifications.
-- Requests, matches and notifications are written by server actions (service role)
-- after checking the caller. Clients only read their own rows.

alter table public.matches
  add column request_id uuid references public.match_requests (id) on delete set null,
  add column a_decision text not null default 'pending' check (a_decision in ('pending', 'accepted', 'skipped')),
  add column b_decision text not null default 'pending' check (b_decision in ('pending', 'accepted', 'skipped')),
  add column decide_by timestamptz not null default now() + interval '45 seconds',
  add constraint matches_two_people check (user_a <> user_b);

create index matches_user_a_idx on public.matches (user_a, created_at desc);
create index matches_user_b_idx on public.matches (user_b, created_at desc);
create index match_requests_user_idx on public.match_requests (user_id, created_at desc);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index meetings_match_key on public.meetings (match_id);

-- Requests: read your own only. Other people's requests are matched server-side,
-- so nobody can list who is hungry where.
revoke insert, update, delete on public.match_requests from authenticated;
drop policy "your match requests" on public.match_requests;
create policy "read your match requests" on public.match_requests
  for select to authenticated using (user_id = auth.uid());

-- Realtime: match decisions and notifications reach the browser as they happen.
-- Postgres changes respect the select policies above.
alter publication supabase_realtime add table public.matches, public.notifications;
