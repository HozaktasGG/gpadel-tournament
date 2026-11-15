import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { type CourtResult, finalMatchesOf, validateFinalFixture } from '@/lib/lights-out'
import { lightsOutRoute, loError } from '@/lib/lights-out-server'

function parseFixture(value: unknown): CourtResult[] | null {
  if (!Array.isArray(value)) return null
  const out: CourtResult[] = []
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) return null
    const { court, team1_id, team2_id, winner_id } = item as Record<string, unknown>
    if (typeof court !== 'number' || typeof team1_id !== 'string' || typeof team2_id !== 'string') return null
    if (winner_id !== null && winner_id !== undefined && typeof winner_id !== 'string') return null
    out.push({ court, team1_id, team2_id, winner_id: typeof winner_id === 'string' && winner_id ? winner_id : null })
  }
  return out
}

// Saves the final as the admin entered it: the two teams on every court, plus the
// winner of each court once known (no game scores). Applies no points.
export async function POST(req: Request) {
  return lightsOutRoute<{ eventId?: string; fixture?: unknown }>(req, async (body, state) => {
    const { tournament } = state
    if (!tournament?.started_at) return loError('Start the event (lock the draw) before entering the final.', 400)

    const fixture = parseFixture(body.fixture)
    if (!fixture) return loError('Invalid final fixture.', 400)
    const names = new Map(state.teams.map(t => [t.id, t.team_name]))
    const invalid = validateFinalFixture(fixture, state.teamIds, tournament.courts, id => names.get(id) ?? 'A team')
    if (invalid) return loError(invalid, 400)

    // Update each court's row in place (insert when missing), then drop any leftovers.
    const existing = finalMatchesOf(state.matches)
    const kept = new Set<string>()
    for (const row of fixture) {
      const current = existing.find(m => m.match_order === row.court && !kept.has(m.id))
      const values = { team1_id: row.team1_id, team2_id: row.team2_id, winner_id: row.winner_id }
      if (current) {
        kept.add(current.id)
        const { error } = await supabaseAdmin.from('team_tournament_matches').update(values).eq('id', current.id)
        if (error) return loError(`Saving Court ${row.court} failed: ` + error.message, 500)
      } else {
        const { error } = await supabaseAdmin.from('team_tournament_matches').insert({
          event_id: state.eventId,
          phase: 'final',
          round_number: state.format.rounds + 1,
          match_order: row.court,
          ...values,
        })
        if (error) return loError(`Saving Court ${row.court} failed: ` + error.message, 500)
      }
    }
    const stale = existing.filter(m => !kept.has(m.id)).map(m => m.id)
    if (stale.length > 0) {
      const { error } = await supabaseAdmin.from('team_tournament_matches').delete().in('id', stale)
      if (error) return loError('Cleaning up old final rows failed: ' + error.message, 500)
    }
    return NextResponse.json({ success: true })
  })
}
