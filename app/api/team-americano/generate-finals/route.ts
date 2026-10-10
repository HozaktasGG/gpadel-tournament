import { NextRequest, NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  FINALS_ROUND,
  GROUP_ROUNDS,
  computeStandings,
  finalMatchesOf,
  finalsPairings,
  groupMatchesOf,
  isScored,
  missingGroupRounds,
} from '@/lib/team-americano'
import { loadTAEvent, parseCourts, readJson } from '@/lib/team-americano-server'

// Round 4: pairs #1v#2 (court 1), #3v#4 (court 2), ... from the group standings.
export async function POST(req: NextRequest) {
  const body = await readJson<{ eventId?: string; courts?: unknown }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const denied = await adminGuard()
  if (denied) return denied

  const eventId = body.eventId?.trim()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  const courts = parseCourts(body.courts)
  if (courts === null) return NextResponse.json({ error: 'Courts must be a whole number between 1 and 20.' }, { status: 400 })

  const state = await loadTAEvent(eventId)
  if ('error' in state) return NextResponse.json({ error: state.error }, { status: state.status })
  const { teamIds, matches } = state

  if (finalMatchesOf(matches).length > 0) {
    return NextResponse.json({ error: 'Finals already generated.' }, { status: 409 })
  }
  if (missingGroupRounds(matches).length > 0) {
    return NextResponse.json({ error: `Play all ${GROUP_ROUNDS} group rounds first.` }, { status: 400 })
  }
  if (!groupMatchesOf(matches).every(isScored)) {
    return NextResponse.json({ error: 'All group matches must be scored.' }, { status: 400 })
  }

  const pairs = finalsPairings(computeStandings(eventId, teamIds, matches))
  if (pairs.length > courts) {
    return NextResponse.json(
      { error: `Finals need ${pairs.length} courts at the same time, but only ${courts} are set.` },
      { status: 400 }
    )
  }

  const rows = pairs.map((p, i) => ({
    event_id: eventId,
    phase: 'final',
    round_number: FINALS_ROUND,
    team1_id: p.team1_id,
    team2_id: p.team2_id,
    match_order: i + 1,
  }))
  const { error } = await supabaseAdmin.from('team_tournament_matches').insert(rows)
  if (error) return NextResponse.json({ error: 'Failed to insert finals: ' + error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
