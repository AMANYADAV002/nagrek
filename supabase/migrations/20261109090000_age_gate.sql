-- Onboarding completes only with an accepted consent AND a stored date of birth
-- that is 18+ today. user_preferences.adult_dob already rejects under-18 rows;
-- this re-checks at completion so an old or missing row cannot slip through.
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
  if not exists (
    select 1 from public.user_preferences
    where user_id = auth.uid()
      and date_of_birth <= (current_date - interval '18 years')
      and date_of_birth >= (current_date - interval '110 years')
  ) then
    raise exception 'Nagrek is only for people 18 and over';
  end if;
  update public.profiles
    set onboarded_at = coalesce(onboarded_at, now())
    where id = auth.uid();
end;
$$;

revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;
