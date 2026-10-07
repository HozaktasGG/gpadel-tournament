# Redesign decisions (ui-redesign)

One line per non-trivial decision. Mockups: `design/01–04`.

## Foundation
- Tailwind 3.4 / Next 14 kept; shadcn/ui components hand-written to match Tailwind 3 (tailwind-merge 2.x, tailwindcss-animate).
- Surface scale named `pitch-*` (not `green-*`) so older pages using stock Tailwind greens are not recolored.
- Orange buttons use dark text (#1a0b05, 6.8:1); white on #ff6b35 fails WCAG AA (2.84:1).
- Display font Barlow Condensed (closest Google font to the mockup's condensed face); body Inter.
- Avatars: real `avatar_url` or initials — never stock photos.
- Event covers always use `public/hero-bg.jpg`; `events.image_url` (organizer logos) is shown as a round badge, never cropped.
- Featured events get a fixed "FEATURED" tag; `events.subtitle` is the line under the title (falls back to the format name).

## iPhone / PWA
- Status bar `black-translucent` + `env(safe-area-inset-*)` on header, bottom nav, sheets and sticky bars.
- Inputs forced to ≥16px on touch devices (older pages used text-sm and would zoom in Safari).
- Add to Calendar: data-URL .ics on iOS (opens the native sheet), file download elsewhere; Americano 90 min, Team 3 h (estimate).
- No service worker yet (push notifications out of scope).

## Data rules (no estimates)
- "Live" = event is today (Turin) and started and not completed, or today's event while the global live-scoring tournament is active; plus legacy `status = 'active'`.
- Podiums / win rate / placings only from recorded team-event matches; hidden for Americano.
- Team podium = final (1st/2nd) since there is no 3rd-place match; Team Americano podium = placement finals 1st–3rd.
- "+N this season" sums score_history since SEASON_START (2026-10-10), excluding quiz rows; hidden at 0.
- Group tables show MP / W / L / +/- (groups rank by wins, then game difference — there are no points).
- Live scoring shows real rounds/courts/minutes; Round 4 courts labelled by the places they decide; players shown with initials (names are not linked to profiles).
- For team-format events, a team registration wins over a leftover solo registration row.

## Pages
- Detail page: no "Schedule" tab (no schedule data before a tournament starts); mockup "Balls / Rounds / Court" facts hidden (no data).
- Discover: city/date filters omitted (all events are in Turin); "Turin, Italy" is a label, not a control; search is client-side over name + venue.
- Home drops the old leaderboard teaser / Why / About sections (mockup is discover-only); those pages stay in the avatar menu, profile links and footer.
- Dashboard: "rating change" per result hidden (not reliably linked to events); shows Rank and the profile's last score change instead.
- Phones have no account menu, so Admin / Leaderboard / About / Sign out live at the bottom of Profile.

## Admin
- Admin primitives in `app/admin/events/[id]/ui.tsx` keep their API but now use the shared sheet/dialog/sonner/avatar/badge, so Teams & picker logic is untouched.
- No "Export PDF fixtures" generator exists: header shows "PDF" only when `pdf_url` is set; Fixtures tab links to the existing fixtures manager.
- No bulk actions exist, so the mockup's row checkboxes are omitted.
- Capacity stepper saves via the existing `updateEvent` action (only `max_players` changes); "Close registration" button folded into the switch (same confirm).
- `featured` / `subtitle` editable in "Edit details" (approved earlier); `updateEvent` only writes them when the editor sends them.
- Admin profiles column list gains `skill_score` (rating column in the table / Add player sheet).
- Registration status select, Edit profile and Remove kept per row (mockup only shows Remove).

## Auth
- Sign in / sign up / account setup share `components/auth/auth-shell.tsx` (court photo, card, Google button); Supabase auth calls unchanged.
- The old "Forgot password?" link pointed to a non-existent `/forgot-password` route (404), so it was removed; a reset flow would be new auth logic.
- `/signin?error=admin_required` now shows a short "organizers only" message (UI text only).

## Remaining pages
- Leaderboard keeps "first name + last initial" masking and its ranking logic; adds `avatar_url` to the column list.
- Legacy April-flow pages (/register, /verify, /cancel, /ticket, /participants) re-themed by a styling-only codemod (colors, headings, orange buttons with dark text); their logic is untouched.
- Phones get a compact footer (social + privacy); full footer on desktop. Mockups show no footer on phones.
- New `app/not-found.tsx`, `app/error.tsx` and route `loading.tsx` skeletons.
- About copy: "Pro badge" corrected to "Advanced" (the highest level that exists).
