import { NextRequest, NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { finalMatchesOf, generateGroupRounds, groupMatchesOf, isScored } from '@/lib/team-americano'
import { loadTAEvent, parseCourts, parseRequired, readJson } from '@/lib/team-americano-server'

// Throws away every group round and draws them all again. Only allowed while no
// group score has been entered and the finals don't exist yet.
export async function POST(req: NextRequest) {
  const body = await readJson<{ eventId?: string; courts?: unknown; required?: unknown }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const denied = await adminGuard()
  if (denied) return denied

  const eventId = body.eventId?.trim()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  const courts = parseCourts(body.courts)
  if (courts === null) return NextResponse.json({ error: 'Courts must be a whole number between 1 and 20.' }, { status: 400 })
  const required = parseRequired(body.required)
  if (required === null) return NextResponse.json({ error: 'Invalid required matchups.' }, { status: 400 })

  const state = await loadTAEvent(eventId)
  if ('error' in state) return NextResponse.json({ error: state.error }, { status: state.status })
  const { format, teamIds, matches } = state

  if (finalMatchesOf(matches).length > 0) {
    return NextResponse.json({ error: 'Finals have already been generated.' }, { status: 409 })
  }
  if (groupMatchesOf(matches).some(isScored)) {
    return NextResponse.json({ error: 'Rounds can only be regenerated before any score is entered.' }, { status: 409 })
  }
  if (teamIds.length < 2) {
    return NextResponse.json({ error: `Need at least 2 approved teams (found ${teamIds.length}).` }, { status: 400 })
  }
  const matchesPerRound = Math.floor(teamIds.length / 2)
  if (matchesPerRound > courts) {
    return NextResponse.json(
      { error: `${teamIds.length} teams need ${matchesPerRound} courts at the same time, but only ${courts} are set.` },
      { status: 400 }
    )
  }

  const { data: teamRows } = await supabaseAdmin.from('team_registrations').select('id, team_name').in('id', teamIds)
  const names = new Map((teamRows ?? []).map(t => [t.id as string, t.team_name as string]))

  // Draw first so a bad requirement doesn't leave the event without rounds.
  const result = generateGroupRounds(teamIds, [], required, id => names.get(id) ?? 'Unknown team', format.groupRounds)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  // Only unscored group matches are deleted, so a score saved meanwhile is never lost.
  const { error: delError } = await supabaseAdmin
    .from('team_tournament_matches')
    .delete()
    .eq('event_id', eventId)
    .eq('phase', 'group')
    .is('team1_score', null)
    .is('team2_score', null)
  if (delError) return NextResponse.json({ error: 'Failed to clear rounds: ' + delError.message }, { status: 500 })

  const { count: left } = await supabaseAdmin
    .from('team_tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
  if ((left ?? 0) > 0) {
    return NextResponse.json(
      { error: 'A score was saved while regenerating — refresh the page and use "Generate Remaining Rounds".' },
      { status: 409 }
    )
  }

  const rows = result.rounds.flatMap(r =>
    r.pairings.map((p, i) => ({
      event_id: eventId,
      phase: 'group',
      round_number: r.round,
      team1_id: p.team1_id,
      team2_id: p.team2_id,
      match_order: i + 1,
    }))
  )
  const { error } = await supabaseAdmin.from('team_tournament_matches').insert(rows)
  if (error) return NextResponse.json({ error: 'Failed to insert matches: ' + error.message }, { status: 500 })

  return NextResponse.json({ success: true, rounds: result.rounds.map(r => r.round) })
}
