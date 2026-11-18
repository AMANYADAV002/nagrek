-- Global story comments. Paste this in the Supabase SQL editor.
-- The app does not apply it. Comments are public to anyone who can see the story.
-- Inserts go through the server. Readers use the select policy and Realtime.

create table public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'emoji', 'gif', 'sticker')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index story_comments_story_idx on public.story_comments (story_id, created_at desc);

alter table public.story_comments enable row level security;

create policy "read story comments" on public.story_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_id
        and (
          s.user_id = auth.uid()
          or (
            not s.hidden
            and s.created_at > now() - interval '24 hours'
            and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = s.user_id)
            and not exists (select 1 from public.blocks b where b.blocker_id = s.user_id and b.blocked_id = auth.uid())
          )
        )
    )
    and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = author_id)
    and not exists (select 1 from public.blocks b where b.blocker_id = author_id and b.blocked_id = auth.uid())
  );

revoke insert, update, delete on public.story_comments from authenticated, anon;
grant select on public.story_comments to authenticated;

alter publication supabase_realtime add table public.story_comments;
