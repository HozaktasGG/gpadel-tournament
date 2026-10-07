-- PROPOSAL (not applied): stop exposing profiles.email / profiles.phone to the
-- public API roles. Every statement is idempotent. Run the steps in order:
--
--   STEP 1  (additive, safe anytime)    -> helper functions
--   deploy  main + ui-redesign code that no longer selects email/phone with the anon key
--   STEP 2  (the actual lock-down)      -> column-level grants on profiles
--   STEP 3  (legacy table)              -> tournament_registrations.email
--
-- Service-role code (supabaseAdmin, API routes, scripts) is unaffected: service_role
-- keeps full table privileges.

------------------------------------------------------------------------------
-- STEP 1 — helper functions (SECURITY DEFINER, fixed search_path)
------------------------------------------------------------------------------

-- The signed-in user's own contact details (profile page "phone" field).
create or replace function public.get_my_contact()
returns table (email text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.email, p.phone from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public.get_my_contact() from public, anon;
grant execute on function public.get_my_contact() to authenticated;

-- Admins only: contact details for a set of profiles (admin team list).
create or replace function public.admin_get_contacts(ids uuid[])
returns table (id uuid, email text, phone text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles a where a.id = auth.uid() and a.is_admin) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query select p.id, p.email, p.phone from public.profiles p where p.id = any(ids);
end;
$$;
revoke all on function public.admin_get_contacts(uuid[]) from public, anon;
grant execute on function public.admin_get_contacts(uuid[]) to authenticated;

-- Leaderboard: legacy (pre-account) quiz entries, de-duplicated against profiles
-- by email on the server, so the client never needs anyone's email.
-- Same rules as app/leaderboard/page.tsx today: a profile with a positive score
-- and the same email wins; legacy rows are de-duplicated by email.
create or replace function public.legacy_leaderboard_entries()
returns table (id uuid, first_name text, last_name text, skill_score integer, last_score_change integer)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (lower(coalesce(r.email, r.id::text)))
         r.id, r.first_name, r.last_name, r.skill_score, r.last_score_change
  from public.tournament_registrations r
  where r.skill_score is not null and r.skill_score > 0
    and r.quiz_completed_at is not null
    and not exists (
      select 1 from public.profiles p
      where p.skill_score is not null and p.skill_score > 0
        and lower(coalesce(p.email, p.id::text)) = lower(coalesce(r.email, r.id::text))
    )
  order by lower(coalesce(r.email, r.id::text)), r.created_at
$$;
revoke all on function public.legacy_leaderboard_entries() from public;
grant execute on function public.legacy_leaderboard_entries() to anon, authenticated;

------------------------------------------------------------------------------
-- STEP 2 — lock down profiles (run only after the code changes are deployed)
------------------------------------------------------------------------------
-- Table-level SELECT is replaced by SELECT on the public columns only.
-- email, phone and quiz_answers become unreadable for anon/authenticated.
-- INSERT/UPDATE privileges and RLS policies are untouched (profile edits keep working).
-- NOTE: columns added to profiles later are NOT readable by the API until granted here.
begin;
revoke select on table public.profiles from anon, authenticated;
grant select (
  id, first_name, last_name, skill_score, skill_level, quiz_completed_at,
  last_score_change, created_at, updated_at, is_admin, avatar_url, player_code
) on table public.profiles to anon, authenticated;
commit;

notify pgrst, 'reload schema';

------------------------------------------------------------------------------
-- STEP 3 — legacy tournament_registrations (11 rows with emails)
------------------------------------------------------------------------------
-- Requires the deployed code: app/api/register/route.ts on the service role (it filters by
-- email), app/register/page.tsx selecting ids only, and the leaderboard using
-- legacy_leaderboard_entries().
begin;
revoke select on table public.tournament_registrations from anon, authenticated;
grant select (
  id, first_name, last_name, tournament_date, tournament_location, created_at,
  email_verified, admin_approved, checked_in, checked_in_at, skill_score,
  skill_level, quiz_completed_at, last_score_change
) on table public.tournament_registrations to anon, authenticated;
commit;
notify pgrst, 'reload schema';
