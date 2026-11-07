import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  type Pairing,
  type RequiredMatchup,
  type TAMatch,
  type TeamAmericanoFormat,
  isTeamAmericano,
  taFinalsRound,
  teamAmericanoFormat,
} from '@/lib/team-americano'

export const MATCH_COLUMNS =
  'id, phase, round_number, team1_id, team2_id, team1_score, team2_score, winner_id, match_order'

export type TAEventState = {
  format: TeamAmericanoFormat
  teamIds: string[]
  matches: TAMatch[]
}

// Loads format + approved teams + matches for a Team Americano event.
// Returns an error string when the event doesn't exist or isn't Team Americano.
export async function loadTAEvent(eventId: string): Promise<TAEventState | { error: string; status: number }> {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, format')
    .eq('id', eventId)
    .maybeSingle<{ id: string; format: string | null }>()
  if (!event) return { error: 'Event not found.', status: 404 }
  if (!isTeamAmericano(event.format)) return { error: 'This event is not a Team Americano event.', status: 400 }

  const [teamsRes, matchesRes] = await Promise.all([
    supabaseAdmin
      .from('team_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('team_tournament_matches').select(MATCH_COLUMNS).eq('event_id', eventId),
  ])
  if (teamsRes.error) return { error: 'Failed to load teams: ' + teamsRes.error.message, status: 500 }
  if (matchesRes.error) return { error: 'Failed to load matches: ' + matchesRes.error.message, status: 500 }

  return {
    format: teamAmericanoFormat(event.format),
    teamIds: (teamsRes.data ?? []).map(t => t.id as string),
    matches: (matchesRes.data ?? []) as TAMatch[],
  }
}

// Inserts the finals (court k = match_order k). A unique index on
// (event_id, match_order) WHERE phase = 'final' makes a concurrent second insert
// fail with 23505, which is reported as 'exists' instead of an error.
export async function insertFinals(
  eventId: string,
  format: TeamAmericanoFormat,
  pairings: Pairing[]
): Promise<'inserted' | 'exists' | { error: string }> {
  const rows = pairings.map((p, i) => ({
    event_id: eventId,
    phase: 'final',
    round_number: taFinalsRound(format),
    team1_id: p.team1_id,
    team2_id: p.team2_id,
    match_order: i + 1,
  }))
  const { error } = await supabaseAdmin.from('team_tournament_matches').insert(rows)
  if (!error) return 'inserted'
  if (error.code === '23505') return 'exists'
  return { error: 'Failed to insert finals: ' + error.message }
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

export function parseRequired(value: unknown): RequiredMatchup[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const out: RequiredMatchup[] = []
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) return null
    const { team1_id, team2_id, round } = item as Record<string, unknown>
    if (typeof team1_id !== 'string' || typeof team2_id !== 'string') return null
    if (round !== null && round !== undefined && (typeof round !== 'number' || !Number.isInteger(round))) return null
    out.push({ team1_id, team2_id, round: typeof round === 'number' ? round : null })
  }
  return out
}

export function parseCourts(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20) return null
  return value
}

// True when the event's format may not change: it's a Team Americano event that
// already has matches (rounds generated). Used by both event-update paths.
export async function taFormatLocked(eventId: string, currentFormat: string | null, nextFormat: string | null) {
  if (!isTeamAmericano(currentFormat) || currentFormat === nextFormat) return false
  const { count } = await supabaseAdmin
    .from('team_tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
  return (count ?? 0) > 0
}

export const FORMAT_LOCKED_MESSAGE =
  "The format can't be changed after the rounds have been generated. Reset the tournament first."
