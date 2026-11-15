import { NextResponse } from 'next/server'
import { finalMatchesOf, finalStandings, parsePointsTable, validateFinalFixture } from '@/lib/lights-out'
import { applyLightsOutPoints, lightsOutRoute, loError } from '@/lib/lights-out-server'

// "Confirm & Apply Points": derives the final standings from the saved final and applies
// the given points table. Safe to call again — after an edit the previous entries of
// this event are rolled back and replaced in the same transaction.
export async function POST(req: Request) {
  return lightsOutRoute<{ eventId?: string; pointsTable?: unknown }>(req, async (body, state) => {
    const { tournament } = state
    if (!tournament?.started_at) return loError('Start the event first.', 400)

    const pointsTable = parsePointsTable(body.pointsTable, tournament.courts)
    if (!pointsTable) return loError('Points must be whole numbers for every court.', 400)

    const finals = finalMatchesOf(state.matches)
    const names = new Map(state.teams.map(t => [t.id, t.team_name]))
    const invalid = validateFinalFixture(
      finals.map(m => ({
        court: m.match_order ?? 0,
        team1_id: m.team1_id ?? '',
        team2_id: m.team2_id ?? '',
        winner_id: m.winner_id,
      })),
      state.teamIds,
      tournament.courts,
      id => names.get(id) ?? 'A team'
    )
    if (invalid) return loError('The saved final is not valid: ' + invalid, 400)

    const standings = finalStandings(finals, pointsTable)
    if (!standings) return loError('Pick and save a winner on every court first.', 400)

    const result = await applyLightsOutPoints(state, standings, pointsTable)
    if ('error' in result) return loError(result.error, 500)
    return NextResponse.json({ success: true, standings, players: result.players })
  })
}
