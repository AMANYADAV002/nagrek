-- Phase 5: video meetings, server-recorded streaks, feedback and reports.

-- Streak days are recorded by the server when a meeting ends, at most once per meeting.
alter table public.streak_events add column meeting_id uuid references public.meetings (id) on delete set null;
create unique index streak_events_meeting_key on public.streak_events (user_id, meeting_id);
revoke insert on public.streak_events from authenticated;
drop policy "add your streak events" on public.streak_events;

-- One feedback per person per meeting. Written by the server, which also updates trust scores.
create unique index feedback_once_key on public.feedback (meeting_id, author_id);
revoke insert on public.feedback from authenticated;
drop policy "write your feedback" on public.feedback;

-- Reports go through a rate-limited server action.
revoke insert on public.reports from authenticated;
drop policy "file a report" on public.reports;

-- WebRTC signalling runs on a private Realtime channel `room:<match id>`.
-- Only the two people in a live match can listen or send on it.
create policy "match participants listen in their room" on realtime.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where (select realtime.topic()) = 'room:' || m.id::text
        and m.status = 'live'
        and (select auth.uid()) in (m.user_a, m.user_b)
    )
  );

create policy "match participants signal in their room" on realtime.messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where (select realtime.topic()) = 'room:' || m.id::text
        and m.status = 'live'
        and (select auth.uid()) in (m.user_a, m.user_b)
    )
  );
