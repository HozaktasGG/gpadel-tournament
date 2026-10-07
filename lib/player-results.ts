import type { SupabaseClient } from '@supabase/supabase-js'
import { isTeamFormat } from '@/lib/event-format'
import { teamPlacement, teamRecord, type TeamMatch } from '@/lib/team-standings'

export type EventLite = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  format: string | null
  status: string | null
  image_url: string | null
}

/** A player's event (solo or team). `team` is set for team registrations. */
export type PlayerEvent = EventLite & {
  team: { id: string; name: string; status: string; captain_id: string | null; partner_id: string | null } | null
}

export type PlayerResult = PlayerEvent & { placement: { label: string; rank: number | null } | null }

export type TeamStats = { podiums: number; wins: number; played: number; events: number }

const EVENT_COLS = 'id, name, date, time, location, format, status, image_url'
const unwrap = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

// Same "today" as the rest of the app (server/browser date).
export function todayString() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

/**
 * All of a player's events: approved solo registrations + team registrations
 * (approved, or pending when `includePendingTeams`). Read-only.
 */
export async function loadPlayerEvents(supabase: SupabaseClient, userId: string, includePendingTeams = false): Promise<PlayerEvent[]> {
  const teamStatuses = includePendingTeams ? ['approved', 'pending_partner', 'pending_approval'] : ['approved']
  const [solo, teams] = await Promise.all([
    supabase.from('event_registrations').select(`event_id, events(${EVENT_COLS})`).eq('user_id', userId).eq('status', 'approved'),
    supabase
      .from('team_registrations')
      .select(`id, team_name, status, captain_id, partner_id, events(${EVENT_COLS})`)
      .or(`captain_id.eq.${userId},partner_id.eq.${userId}`)
      .in('status', teamStatuses),
  ])
  // Team registrations first: for team-format events they are the real entry
  // (a leftover solo row for the same event must not win).
  const out: PlayerEvent[] = []
  type TeamRow = { id: string; team_name: string; status: string; captain_id: string | null; partner_id: string | null; events: EventLite | EventLite[] | null }
  for (const r of (teams.data ?? []) as unknown as TeamRow[]) {
    const ev = unwrap(r.events)
    if (!ev || out.some(o => o.id === ev.id)) continue
    out.push({ ...ev, team: { id: r.id, name: r.team_name, status: r.status, captain_id: r.captain_id, partner_id: r.partner_id } })
  }
  for (const r of (solo.data ?? []) as unknown as { events: EventLite | EventLite[] | null }[]) {
    const ev = unwrap(r.events)
    if (ev && !out.some(o => o.id === ev.id)) out.push({ ...ev, team: null })
  }
  return out
}

/**
 * Past events newest-first, with placements for team events taken only from
 * recorded matches (no estimates), plus podium/win-rate stats for team events.
 */
export async function loadPlayerResults(
  supabase: SupabaseClient,
  events: PlayerEvent[]
): Promise<{ results: PlayerResult[]; teamStats: TeamStats | null }> {
  const today = todayString()
  const past = events
    .filter(e => e.date < today && (!e.team || e.team.status === 'approved'))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const teamEvents = past.filter(p => p.team && isTeamFormat(p.format))
  let matches: (TeamMatch & { event_id: string })[] = []
  if (teamEvents.length) {
    const { data } = await supabase
      .from('team_tournament_matches')
      .select('id, phase, group_name, round_number, team1_id, team2_id, team1_score, team2_score, winner_id, match_order, event_id')
      .in('event_id', teamEvents.map(t => t.id))
    matches = (data ?? []) as (TeamMatch & { event_id: string })[]
  }

  let podiums = 0
  let wins = 0
  let played = 0
  let counted = 0
  const results: PlayerResult[] = past.map(p => {
    if (!p.team || !isTeamFormat(p.format)) return { ...p, placement: null }
    const ms = matches.filter(m => m.event_id === p.id)
    const placement = teamPlacement(p.format, p.team.id, ms)
    const rec = teamRecord(p.team.id, ms)
    if (rec.played > 0) counted++
    wins += rec.wins
    played += rec.played
    // Team: no 3rd-place match, so podium = final (1st/2nd). Team Americano: placement finals 1st–3rd.
    if (placement?.rank && placement.rank <= (p.format === 'Team Americano' ? 3 : 2)) podiums++
    return { ...p, placement }
  })
  return { results, teamStats: counted > 0 ? { podiums, wins, played, events: counted } : null }
}
