-- Lights Out format. Safe to re-run.
--
-- Reuses team_registrations (teams) and team_tournament_matches (phase 'draw' = initial
-- court draw, phase 'final' = final fixture + winner_id; match_order = court number).
-- Adds only: one settings/result row per event, an event link on score_history, and one
-- function that applies / rolls back leaderboard points in a single transaction.

-- ───────────── 1. Per-event Lights Out state ─────────────

create table if not exists public.lights_out_tournaments (
  event_id uuid primary key references public.events(id) on delete cascade,
  courts integer not null check (courts >= 2),
  started_at timestamptz,          -- set when the draw is locked ("Start event")
  points_table jsonb,              -- table actually used: [{court, winner, loser}]
  applied_standings jsonb,         -- snapshot: [{rank, court, team_id, won, points}]
  points_applied_at timestamptz,   -- null until "Confirm & Apply Points"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lights_out_tournaments enable row level security;

-- Anyone may read (court count, lock state, final standings). No personal data here.
drop policy if exists "Public can view lights out" on public.lights_out_tournaments;
create policy "Public can view lights out"
  on public.lights_out_tournaments
  for select
  using (true);

-- Only signed-in admins, or managers of that event, may write. Anon can never write.
drop policy if exists "Admins and event managers manage lights out" on public.lights_out_tournaments;
create policy "Admins and event managers manage lights out"
  on public.lights_out_tournaments
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
    or exists (
      select 1 from public.event_managers em
      where em.user_id = auth.uid() and em.event_id = lights_out_tournaments.event_id
    )
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
    or exists (
      select 1 from public.event_managers em
      where em.user_id = auth.uid() and em.event_id = lights_out_tournaments.event_id
    )
  );

revoke insert, update, delete, truncate on public.lights_out_tournaments from anon;

-- One draw row per court (a double tap / second phone cannot create a second draw).
create unique index if not exists team_tournament_matches_draw_court_key
  on public.team_tournament_matches (event_id, match_order)
  where phase = 'draw';

-- ───────────── 2. score_history: link entries to an event ─────────────
-- score_history.tournament_id points at public.tournaments (Court Americano only).
-- Lights Out has no such row, so its entries are tied to the event instead.

alter table public.score_history
  add column if not exists event_id uuid references public.events(id) on delete set null;

-- At most one entry per player per event: the database itself refuses a double count.
create unique index if not exists score_history_event_user_key
  on public.score_history (event_id, user_id)
  where event_id is not null;

-- ───────────── 3. Apply / roll back points atomically ─────────────
-- p_entries: [{"user_id": "<uuid>", "change": <int>}, ...] = the complete set of points
-- this event should have applied. The function diffs it against what is already applied
-- (score_history rows with this event_id) and moves each profile by the difference only,
-- so calling it twice, or again after an edit, never double-counts. An empty array rolls
-- everything back. Later history rows of the same player keep a correct running total.

create or replace function public.lights_out_apply_points(
  p_event_id uuid,
  p_reason text,
  p_entries jsonb,
  p_points_table jsonb,
  p_standings jsonb
)
returns table (profile_id uuid, new_score integer)
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_delta integer;
  v_score integer;
  v_has_later boolean;
  v_touched uuid[] := '{}';
  v_entries jsonb := coalesce(p_entries, '[]'::jsonb);
begin
  -- Serialise concurrent calls for the same event.
  perform 1 from lights_out_tournaments t where t.event_id = p_event_id for update;
  if not found then
    raise exception 'Lights Out tournament not found for event %', p_event_id;
  end if;

  if (select count(*) <> count(distinct e->>'user_id') from jsonb_array_elements(v_entries) e) then
    raise exception 'A player appears more than once in the points entries';
  end if;

  for r in
    select coalesce(n.uid, o.uid) as uid,
           o.id as hist_id,
           o.change as old_change,
           o.created_at as old_at,
           n.change as new_change
    from (
      select (e->>'user_id')::uuid as uid, (e->>'change')::integer as change
      from jsonb_array_elements(v_entries) e
    ) n
    full join (
      select h.id, h.user_id as uid, h.change, h.created_at
      from score_history h
      where h.event_id = p_event_id
    ) o on o.uid = n.uid
  loop
    v_delta := coalesce(r.new_change, 0) - coalesce(r.old_change, 0);

    update profiles p
      set skill_score = coalesce(p.skill_score, 0) + v_delta
      where p.id = r.uid
      returning p.skill_score into v_score;
    if not found then
      if r.new_change is not null then
        raise exception 'Profile % not found', r.uid;
      end if;
      delete from score_history h where h.id = r.hist_id;
      continue;
    end if;

    if r.hist_id is not null then
      -- Keep the running total of anything this player earned afterwards correct.
      update score_history h
        set score = h.score + v_delta
        where h.user_id = r.uid and h.created_at > r.old_at;
      v_has_later := found;

      if r.new_change is null then
        delete from score_history h where h.id = r.hist_id;
      else
        update score_history h
          set change = r.new_change, score = h.score + v_delta, reason = p_reason
          where h.id = r.hist_id;
      end if;
    else
      insert into score_history (user_id, score, change, reason, event_id)
        values (r.uid, v_score, r.new_change, p_reason, p_event_id);
      v_has_later := false;
    end if;

    if not v_has_later then
      update profiles p set last_score_change = coalesce(r.new_change, 0) where p.id = r.uid;
    end if;

    v_touched := v_touched || r.uid;
  end loop;

  if jsonb_array_length(v_entries) = 0 then
    update lights_out_tournaments t
      set points_table = null, applied_standings = null, points_applied_at = null, updated_at = now()
      where t.event_id = p_event_id;
  else
    update lights_out_tournaments t
      set points_table = p_points_table, applied_standings = p_standings, points_applied_at = now(), updated_at = now()
      where t.event_id = p_event_id;
  end if;

  return query select p.id, p.skill_score from profiles p where p.id = any (v_touched);
end;
$$;

-- Server-side only (API routes use the service_role key).
revoke all on function public.lights_out_apply_points(uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.lights_out_apply_points(uuid, text, jsonb, jsonb, jsonb) to service_role;

-- ───────────── 4. Close an existing hole on score_history ─────────────
-- The old policy "Service role can insert" is granted to PUBLIC with CHECK (true), so
-- anyone holding the public anon key could insert history rows. The service_role key
-- bypasses RLS and every writer in the app uses it, so the policy is not needed.

drop policy if exists "Service role can insert" on public.score_history;
