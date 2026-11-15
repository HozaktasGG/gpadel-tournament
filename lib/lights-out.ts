// Shared Lights Out logic (admin manager, API routes and the public event page).
// Format: fixed teams of two on ranked courts (Court 1 = top). Each round the winner of a
// court moves up one court and the loser moves down one. Rounds are played offline and are
// never stored. Only three things are stored: the initial random draw, the final fixture
// with its winners, and the points that were applied.
//
// Storage (team_tournament_matches): phase 'draw' = initial draw, phase 'final' = final
// fixture. In both, match_order is the court number. Finals carry winner_id, no scores.

import { type ScheduleSlot, withClockTimes } from './americano-format'

// ───────────────────────── Formats ─────────────────────────

export type LightsOutFormat = {
  name: string
  variant: 90 | 120
  rounds: number
  roundMinutes: number
  finalMinutes: number
}

export const LIGHTS_OUT_FORMATS: Record<string, LightsOutFormat> = {
  'Lights Out 90': { name: 'Lights Out 90', variant: 90, rounds: 4, roundMinutes: 15, finalMinutes: 30 },
  'Lights Out 120': { name: 'Lights Out 120', variant: 120, rounds: 6, roundMinutes: 15, finalMinutes: 30 },
}

export const LIGHTS_OUT_FORMAT_NAMES = Object.keys(LIGHTS_OUT_FORMATS)
export const DEFAULT_LO_FORMAT = 'Lights Out 90'

export const isLightsOut = (format: string | null | undefined): boolean =>
  !!format && Object.prototype.hasOwnProperty.call(LIGHTS_OUT_FORMATS, format)

export const lightsOutFormat = (format: string | null | undefined): LightsOutFormat =>
  (format && isLightsOut(format) ? LIGHTS_OUT_FORMATS[format] : null) ?? LIGHTS_OUT_FORMATS[DEFAULT_LO_FORMAT]

export const loTotalMinutes = (f: LightsOutFormat): number => f.rounds * f.roundMinutes + f.finalMinutes

// "90 min · 4×15 + Final 30"
export const loStructureLabel = (f: LightsOutFormat): string =>
  `${loTotalMinutes(f)} min · ${f.rounds}×${f.roundMinutes} + Final ${f.finalMinutes}`

export function lightsOutSchedule(f: LightsOutFormat, startTime?: string | null): ScheduleSlot[] {
  const slots: Omit<ScheduleSlot, 'start' | 'end'>[] = []
  for (let r = 1; r <= f.rounds; r++) slots.push({ kind: 'round', label: `Round ${r}`, minutes: f.roundMinutes })
  slots.push({ kind: 'finals', label: 'Final', minutes: f.finalMinutes })
  return withClockTimes(slots, startTime)
}

export const lightsOutRules = (f: LightsOutFormat, courts: number): string[] => [
  `Court 1 is the top court, Court ${courts} is the bottom court.`,
  'Each round, the team that wins more games on a court moves UP one court; the other team moves DOWN one court.',
  `The Court 1 winner stays on Court 1. The Court ${courts} loser stays on Court ${courts}.`,
  `${f.rounds} rounds of ${f.roundMinutes} minutes, then a ${f.finalMinutes}-minute final (${loTotalMinutes(f)} minutes in total).`,
  'The final decides everything: Court 1 winner is 1st, Court 1 loser 2nd, Court 2 winner 3rd, and so on.',
]

// ───────────────────────── Courts & draw ─────────────────────────

export const MIN_COURTS = 2
export const DEFAULT_LO_COURTS = 4

export const requiredTeams = (courts: number): number => courts * 2

export const validCourts = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_COURTS

export type LOMatch = {
  id: string
  phase: string
  team1_id: string | null
  team2_id: string | null
  winner_id: string | null
  match_order: number | null
}

export type CourtPair = { court: number; team1_id: string; team2_id: string }
export type CourtResult = CourtPair & { winner_id: string | null }

const byCourt = (a: LOMatch, b: LOMatch) => (a.match_order ?? 0) - (b.match_order ?? 0)

export const drawMatchesOf = (matches: LOMatch[]): LOMatch[] => matches.filter(m => m.phase === 'draw').sort(byCourt)
export const finalMatchesOf = (matches: LOMatch[]): LOMatch[] => matches.filter(m => m.phase === 'final').sort(byCourt)

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function teamCountError(courts: number, teamCount: number): string | null {
  const need = requiredTeams(courts)
  if (teamCount === need) return null
  return `${courts} courts need exactly ${need} teams, but ${teamCount} ${teamCount === 1 ? 'is' : 'are'} approved.`
}

// Random draw: two teams per court. Requires exactly courts × 2 teams.
export function drawCourts(
  teamIds: string[],
  courts: number,
  rng: () => number = Math.random
): { draw: CourtPair[] } | { error: string } {
  if (!validCourts(courts)) return { error: `At least ${MIN_COURTS} courts are needed.` }
  if (new Set(teamIds).size !== teamIds.length) return { error: 'A team is listed twice.' }
  const countError = teamCountError(courts, teamIds.length)
  if (countError) return { error: countError }
  const order = shuffle(teamIds, rng)
  return {
    draw: Array.from({ length: courts }, (_, c) => ({ court: c + 1, team1_id: order[c * 2], team2_id: order[c * 2 + 1] })),
  }
}

// A saved draw is usable only while it still holds exactly the approved teams.
export function drawIsCurrent(draw: LOMatch[], teamIds: string[]): boolean {
  const drawn = draw.flatMap(m => [m.team1_id, m.team2_id])
  return drawn.length === teamIds.length && teamIds.every(id => drawn.includes(id)) && new Set(drawn).size === drawn.length
}

// ───────────────────────── Final ─────────────────────────

// Checks an admin-entered final fixture: courts 1..N once each, every team exactly once.
export function validateFinalFixture(
  fixture: CourtResult[],
  teamIds: string[],
  courts: number,
  teamName: (id: string) => string = id => id
): string | null {
  if (fixture.length !== courts) return `Enter the two teams for all ${courts} courts.`
  const seenCourts = new Set<number>()
  const seenTeams = new Set<string>()
  const known = new Set(teamIds)
  for (const row of fixture) {
    if (!Number.isInteger(row.court) || row.court < 1 || row.court > courts) return `Court ${row.court} does not exist.`
    if (seenCourts.has(row.court)) return `Court ${row.court} is entered twice.`
    seenCourts.add(row.court)
    if (!row.team1_id || !row.team2_id) return `Court ${row.court}: pick both teams.`
    for (const id of [row.team1_id, row.team2_id]) {
      if (!known.has(id)) return `Court ${row.court}: that team is not an approved team of this event.`
      if (seenTeams.has(id)) return `${teamName(id)} is selected more than once.`
      seenTeams.add(id)
    }
    if (row.winner_id && row.winner_id !== row.team1_id && row.winner_id !== row.team2_id) {
      return `Court ${row.court}: the winner must be one of the two teams on that court.`
    }
  }
  const missing = teamIds.filter(id => !seenTeams.has(id))
  if (missing.length > 0) return `${missing.map(teamName).join(', ')} ${missing.length === 1 ? 'is' : 'are'} not on any court.`
  return null
}

// ───────────────────────── Points & standings ─────────────────────────

export type CourtPoints = { court: number; winner: number; loser: number }

// Default leaderboard points by final court. With 3 courts this equals Court Americano.
export function defaultPointsTable(courts: number): CourtPoints[] {
  return Array.from({ length: courts }, (_, i) => {
    const court = i + 1
    if (court === 1) return { court, winner: 80, loser: 50 }
    if (court === courts) return { court, winner: -10, loser: -25 }
    if (court === 2) return { court, winner: 30, loser: 10 }
    return { court, winner: 10, loser: 0 }
  })
}

const validPoints = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= 1000

export function parsePointsTable(value: unknown, courts: number): CourtPoints[] | null {
  if (!Array.isArray(value) || value.length !== courts) return null
  const out: CourtPoints[] = []
  for (let i = 0; i < courts; i++) {
    const row = (value as unknown[]).find(r => typeof r === 'object' && r !== null && (r as CourtPoints).court === i + 1) as
      | CourtPoints
      | undefined
    if (!row || !validPoints(row.winner) || !validPoints(row.loser)) return null
    out.push({ court: i + 1, winner: row.winner, loser: row.loser })
  }
  return out
}

export type LOStanding = { rank: number; court: number; team_id: string; won: boolean; points: number }

// Final ranking from court placement only: winner of court k = rank 2k-1, loser = 2k.
// Returns null until every final court has a winner.
export function finalStandings(finals: LOMatch[], pointsTable: CourtPoints[]): LOStanding[] | null {
  const sorted = finalMatchesOf(finals)
  if (sorted.length === 0 || sorted.length !== pointsTable.length) return null
  const out: LOStanding[] = []
  for (const m of sorted) {
    const court = m.match_order ?? 0
    const pts = pointsTable.find(p => p.court === court)
    if (!pts || !m.team1_id || !m.team2_id || !m.winner_id) return null
    if (m.winner_id !== m.team1_id && m.winner_id !== m.team2_id) return null
    const loser = m.winner_id === m.team1_id ? m.team2_id : m.team1_id
    out.push(
      { rank: court * 2 - 1, court, team_id: m.winner_id, won: true, points: pts.winner },
      { rank: court * 2, court, team_id: loser, won: false, points: pts.loser }
    )
  }
  return out.sort((a, b) => a.rank - b.rank)
}

export const sameStandings = (a: LOStanding[] | null, b: LOStanding[] | null): boolean =>
  !!a && !!b && a.length === b.length && a.every((s, i) => s.team_id === b[i].team_id && s.rank === b[i].rank && s.points === b[i].points)

// ───────────────────────── Stored state / public view ─────────────────────────

// Row of public.lights_out_tournaments.
export type LOTournament = {
  event_id: string
  courts: number
  started_at: string | null
  points_table: CourtPoints[] | null
  applied_standings: LOStanding[] | null
  points_applied_at: string | null
}

export const LO_TOURNAMENT_COLUMNS = 'event_id, courts, started_at, points_table, applied_standings, points_applied_at'
export const LO_MATCH_COLUMNS = 'id, phase, team1_id, team2_id, winner_id, match_order'

export type LOTeamView = { id: string; team_name: string; players: string[] }

// What the public event page shows. Names only, no contact details.
export type LOPublicState = {
  courts: number
  started: boolean
  teams: LOTeamView[]
  draw: CourtPair[]
  standings: LOStanding[] | null // only after "Confirm & Apply Points"
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export const signed = (n: number): string => (n > 0 ? `+${n}` : String(n))
