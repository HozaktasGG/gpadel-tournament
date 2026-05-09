import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Round-robin (circle method): for n teams, generates n-1 rounds where every
// pair plays exactly once and each team plays exactly once per round.
function generateRoundRobin(n: number): number[][][] {
  const rounds: number[][][] = []
  const fixed = 0
  let rotating = Array.from({ length: n - 1 }, (_, i) => i + 1)
  for (let r = 0; r < n - 1; r++) {
    const round: number[][] = []
    const all = [fixed, ...rotating]
    for (let i = 0; i < n / 2; i++) {
      round.push([all[i], all[n - 1 - i]])
    }
    rounds.push(round)
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)]
  }
  return rounds
}

export async function POST(req: NextRequest) {
  let body: { password?: string; eventId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const eventId = body.eventId?.trim()
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('team_tournament_matches')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Schedule already generated.' }, { status: 409 })
  }

  const { data: teams } = await supabaseAdmin
    .from('team_registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'approved')

  const teamIds = (teams ?? []).map(t => t.id as string)
  if (teamIds.length !== 8) {
    return NextResponse.json(
      { error: `Need exactly 8 approved teams (found ${teamIds.length}).` },
      { status: 400 }
    )
  }

  const shuffledTeams = shuffle(teamIds)
  const allRounds = generateRoundRobin(8)
  const pickedRounds = shuffle(allRounds).slice(0, 3)

  type MatchInsert = {
    event_id: string
    phase: 'group'
    round_number: number
    team1_id: string
    team2_id: string
    match_order: number
  }
  const matchRows: MatchInsert[] = []
  pickedRounds.forEach((round, rIdx) => {
    const shuffledRound = shuffle(round)
    shuffledRound.forEach(([a, b], mIdx) => {
      matchRows.push({
        event_id: eventId,
        phase: 'group',
        round_number: rIdx + 1,
        team1_id: shuffledTeams[a],
        team2_id: shuffledTeams[b],
        match_order: mIdx + 1,
      })
    })
  })

  const { error: insertErr } = await supabaseAdmin
    .from('team_tournament_matches')
    .insert(matchRows)
  if (insertErr) {
    return NextResponse.json(
      { error: 'Failed to insert matches: ' + insertErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
