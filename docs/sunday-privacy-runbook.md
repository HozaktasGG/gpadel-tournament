# Sunday privacy runbook — hide profile contact details

Goal: anonymous/authenticated API users can no longer read `profiles.email`, `profiles.phone`,
`profiles.quiz_answers` or `tournament_registrations.email`.

- SQL: `supabase/proposals/hide-profile-contacts.sql` (steps 1–3), rollback: `supabase/proposals/hide-profile-contacts.rollback.sql`
- Code: branch `privacy-hotfix` (from `main`, includes the team-join hotfix). Do **not** run before Sunday Oct 11.

## Steps

1. **Supabase SQL Editor → run STEP 1 only** (helper functions; additive).
   Check: `select * from public.legacy_leaderboard_entries() limit 5;` returns rows. smashtorino.com looks unchanged.
2. **Deploy the code:** `git checkout main && git merge --ff-only privacy-hotfix && git push`. Wait until Vercel shows **Ready**.
3. **Check smashtorino.com (signed in as admin):**
   nav shows your avatar + Admin link · `/dashboard` loads with name/rating · `/profile` shows **your phone** ·
   `/leaderboard` lists players · `/admin` → team registrations list shows names **and emails** · a team-invite link opens (no "Invite not found").
4. **SQL Editor → run STEP 2** (profiles lock-down).
5. **Verify the lock:** `set role anon; select email from public.profiles limit 1;` → must fail with *permission denied*. Then `reset role;`.
6. **Re-check the site:** repeat step 3 · edit and save your profile (phone must stay the same) · open a tournament page (Players/Teams lists load) · sign out and back in.
7. **SQL Editor → run STEP 3** (legacy table). Then `set role anon; select email from public.tournament_registrations limit 1;` → denied; `reset role;`.
8. **Check:** `/leaderboard` still shows the older quiz-only players; `/register` shows its spot counter.
9. **If anything breaks at any step:** run the grant part of the rollback file. Access is restored immediately and the new code does not need those columns, so the site keeps working. Then investigate.
10. **Afterwards:** `git worktree remove "%TEMP%\st-privacy-hotfix"` (if the worktree still exists) and merge `main` into `ui-redesign` (same changes on both; conflicts should be trivial).
