-- History chat and "crave again" invites.
-- Paste this file in the Supabase SQL editor. The app does not apply it.
-- History cards themselves are read from matches and visits, which already exist.

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  pair_low uuid not null references public.profiles (id) on delete cascade,
  pair_high uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'voice')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint direct_messages_ordered check (pair_low < pair_high),
  constraint direct_messages_sender check (sender_id = pair_low or sender_id = pair_high)
);

create index direct_messages_pair_idx on public.direct_messages (pair_low, pair_high, created_at);

alter table public.direct_messages enable row level security;

create policy "read your direct messages" on public.direct_messages
  for select to authenticated
  using (pair_low = auth.uid() or pair_high = auth.uid());

grant select on public.direct_messages to authenticated;
revoke insert, update, delete on public.direct_messages from authenticated, anon;

create table public.craving_invites (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  food text not null check (char_length(food) between 1 and 40),
  vibe text check (vibe is null or char_length(vibe) <= 80),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint craving_invites_two_people check (from_id <> to_id)
);

create index craving_invites_to_idx on public.craving_invites (to_id, created_at desc);
create unique index craving_invites_one_pending on public.craving_invites (from_id, to_id) where status = 'pending';

alter table public.craving_invites enable row level security;

create policy "read your craving invites" on public.craving_invites
  for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

grant select on public.craving_invites to authenticated;
revoke insert, update, delete on public.craving_invites from authenticated, anon;

alter publication supabase_realtime add table public.direct_messages, public.craving_invites;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes', 'voice-notes', false, 300000,
  array['audio/webm', 'video/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No client policies: the server uploads with the service role and hands back a short-lived signed URL.
