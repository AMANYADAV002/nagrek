-- Chat media: emoji, GIF, and sticker messages.
-- Paste this in the Supabase SQL editor. It widens direct_messages so a GIF URL
-- and the new kinds can be stored. Text and voice notes stay as they are.

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'direct_messages'
      and con.contype = 'c'
      and (
        pg_get_constraintdef(con.oid) ilike '%kind%'
        or pg_get_constraintdef(con.oid) ilike '%char_length(body)%'
      )
  loop
    execute format('alter table public.direct_messages drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.direct_messages
  add constraint direct_messages_kind_check
  check (kind in ('text', 'voice', 'emoji', 'gif', 'sticker'));

alter table public.direct_messages
  add constraint direct_messages_body_check
  check (char_length(body) between 1 and 2000);
