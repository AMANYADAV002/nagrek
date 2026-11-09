-- Fix: the wish-list and future-plan policies referenced each other's tables in a loop
-- (items -> shares -> items), which Postgres rejects as infinite recursion whenever a
-- query reads both. Ownership checks now go through security-definer helpers that read
-- the parent row without re-applying its policy.

create or replace function public.owns_wish(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.wishlist_items where id = p_item and user_id = auth.uid());
$$;

create or replace function public.owns_future_plan(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.plans_future where id = p_plan and user_id = auth.uid());
$$;

revoke all on function public.owns_wish(uuid) from public, anon;
revoke all on function public.owns_future_plan(uuid) from public, anon;
grant execute on function public.owns_wish(uuid) to authenticated;
grant execute on function public.owns_future_plan(uuid) to authenticated;

drop policy "see shares you made or received" on public.wishlist_shares;
create policy "see shares you made or received" on public.wishlist_shares
  for select to authenticated
  using (shared_with = auth.uid() or public.owns_wish(item_id));

drop policy "share your own wish" on public.wishlist_shares;
create policy "share your own wish" on public.wishlist_shares
  for insert to authenticated
  with check (public.owns_wish(item_id));

drop policy "unshare your own wish" on public.wishlist_shares;
create policy "unshare your own wish" on public.wishlist_shares
  for delete to authenticated
  using (public.owns_wish(item_id));

drop policy "see your invites" on public.plan_invites;
create policy "see your invites" on public.plan_invites
  for select to authenticated
  using (invitee_id = auth.uid() or public.owns_future_plan(plan_id));

drop policy "invite to your plan" on public.plan_invites;
create policy "invite to your plan" on public.plan_invites
  for insert to authenticated
  with check (public.owns_future_plan(plan_id));
