-- ROLLBACK for hide-profile-contacts.sql. Idempotent.
-- Restores table-wide SELECT (the current behaviour). Run the grant part first;
-- drop the helper functions only after no deployed code calls them.

begin;
grant select on table public.profiles to anon, authenticated;
-- Only if STEP 3 was applied:
grant select on table public.tournament_registrations to anon, authenticated;
commit;

notify pgrst, 'reload schema';

-- After reverting the code that calls them (optional):
-- drop function if exists public.get_my_contact();
-- drop function if exists public.admin_get_contacts(uuid[]);
-- drop function if exists public.legacy_leaderboard_entries();
