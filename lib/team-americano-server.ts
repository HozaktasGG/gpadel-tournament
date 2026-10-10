import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { TAMatch } from '@/lib/team-americano'

export const TA_FORMAT = 'Team Americano'

export const MATCH_COLUMNS =
  'id, phase, round_number, team1_id, team2_id, team1_score, team2_score, winner_id, match_order'

export type TAEventState = {
  teamIds: string[]
  matches: TAMatch[]
}

// Loads approved teams + matches for a Team Americano event.
// Returns an error string when the event doesn't exist or isn't Team Americano.
export async function loadTAEvent(eventId: string): Promise<TAEventState | { error: string; status: number }> {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, format')
    .eq('id', eventId)
    .maybeSingle<{ id: string; format: string | null }>()
  if (!event) return { error: 'Event not found.', status: 404 }
  if (event.format !== TA_FORMAT) return { error: 'This event is not a Team Americano event.', status: 400 }

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
    teamIds: (teamsRes.data ?? []).map(t => t.id as string),
    matches: (matchesRes.data ?? []) as TAMatch[],
  }
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

export function parseCourts(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20) return null
  return value
}
