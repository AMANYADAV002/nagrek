-- Clients cannot write profiles.onboarded_at (it gates the app), so onboarding
-- completes through this function, which requires an accepted consent first.
create or replace function public.complete_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (
    select 1 from public.consents
    where user_id = auth.uid() and adult and respectful
  ) then
    raise exception 'Consent required';
  end if;
  update public.profiles
    set onboarded_at = coalesce(onboarded_at, now())
    where id = auth.uid();
end;
$$;

revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;
