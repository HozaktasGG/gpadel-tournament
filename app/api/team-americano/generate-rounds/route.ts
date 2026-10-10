import { NextRequest, NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { type RequiredMatchup, finalMatchesOf, generateGroupRounds, missingGroupRounds } from '@/lib/team-americano'
import { loadTAEvent, parseCourts, readJson } from '@/lib/team-americano-server'

function parseRequired(value: unknown): RequiredMatchup[] | null {
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

// Generates every missing group round at once ("Start Tournament" / "Generate Remaining Rounds").
// Existing rounds are never modified.
export async function POST(req: NextRequest) {
  const body = await readJson<{ eventId?: string; courts?: unknown; required?: unknown; rounds?: unknown }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const denied = await adminGuard()
  if (denied) return denied

  const eventId = body.eventId?.trim()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  const courts = parseCourts(body.courts)
  if (courts === null) return NextResponse.json({ error: 'Courts must be a whole number between 1 and 20.' }, { status: 400 })
  const required = parseRequired(body.required)
  if (required === null) return NextResponse.json({ error: 'Invalid required matchups.' }, { status: 400 })
  // The rounds the admin expects to create (what was missing when the page loaded).
  const targetRounds = body.rounds
  if (!Array.isArray(targetRounds) || targetRounds.length === 0 || !targetRounds.every(r => Number.isInteger(r))) {
    return NextResponse.json({ error: 'Missing target rounds.' }, { status: 400 })
  }

  const state = await loadTAEvent(eventId)
  if ('error' in state) return NextResponse.json({ error: state.error }, { status: state.status })
  const { teamIds, matches } = state

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
  if (finalMatchesOf(matches).length > 0) {
    return NextResponse.json({ error: 'Finals have already been generated.' }, { status: 409 })
  }
  // Server-side guard: reject if any target round already exists (e.g. a double tap or a
  // second admin phone), or if the set of missing rounds changed since the page loaded.
  const missing = missingGroupRounds(matches)
  const alreadyThere = (targetRounds as number[]).filter(r => !missing.includes(r))
  if (alreadyThere.length > 0 || missing.length !== targetRounds.length) {
    const which = alreadyThere.length > 0 ? alreadyThere.map(r => `Round ${r}`).join(', ') + ' already exists' : 'The rounds changed'
    return NextResponse.json({ error: `${which} — refresh the page.` }, { status: 409 })
  }

  const { data: teamRows } = await supabaseAdmin.from('team_registrations').select('id, team_name').in('id', teamIds)
  const names = new Map((teamRows ?? []).map(t => [t.id as string, t.team_name as string]))

  const result = generateGroupRounds(teamIds, matches, required, id => names.get(id) ?? 'Unknown team')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

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

  return NextResponse.json({
    success: true,
    rounds: result.rounds.map(r => r.round),
    byes: result.rounds.filter(r => r.bye).map(r => ({ round: r.round, team_id: r.bye })),
  })
}
