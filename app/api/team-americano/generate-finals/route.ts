import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type MatchRow = {
  team1_id: string | null
  team2_id: string | null
  team1_score: number | null
  team2_score: number | null
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

  const { data: existingFinals } = await supabaseAdmin
    .from('team_tournament_matches')
    .select('id')
    .eq('event_id', eventId)
    .eq('phase', 'final')
    .limit(1)
  if (existingFinals && existingFinals.length > 0) {
    return NextResponse.json({ error: 'Finals already generated.' }, { status: 409 })
  }

  const { data: groupMatchesData } = await supabaseAdmin
    .from('team_tournament_matches')
    .select('team1_id, team2_id, team1_score, team2_score')
    .eq('event_id', eventId)
    .eq('phase', 'group')

  const groupMatches = (groupMatchesData ?? []) as MatchRow[]
  if (groupMatches.length === 0) {
    return NextResponse.json({ error: 'No group matches found.' }, { status: 400 })
  }
  if (groupMatches.some(m => m.team1_score == null || m.team2_score == null)) {
    return NextResponse.json({ error: 'All group matches must be scored.' }, { status: 400 })
  }

  const diffByTeam = new Map<string, number>()
  for (const m of groupMatches) {
    if (!m.team1_id || !m.team2_id || m.team1_score == null || m.team2_score == null) continue
    const diff = m.team1_score - m.team2_score
    diffByTeam.set(m.team1_id, (diffByTeam.get(m.team1_id) ?? 0) + diff)
    diffByTeam.set(m.team2_id, (diffByTeam.get(m.team2_id) ?? 0) - diff)
  }

  const ranked = Array.from(diffByTeam.entries())
    .map(([id, diff]) => ({ id, diff }))
    .sort((a, b) => b.diff - a.diff)

  if (ranked.length !== 8) {
    return NextResponse.json(
      { error: `Expected 8 teams in standings (got ${ranked.length}).` },
      { status: 500 }
    )
  }

  type FinalInsert = {
    event_id: string
    phase: 'final'
    match_order: number
    team1_id: string
    team2_id: string
  }
  const inserts: FinalInsert[] = [
    { event_id: eventId, phase: 'final', match_order: 1, team1_id: ranked[0].id, team2_id: ranked[1].id },
    { event_id: eventId, phase: 'final', match_order: 2, team1_id: ranked[2].id, team2_id: ranked[3].id },
    { event_id: eventId, phase: 'final', match_order: 3, team1_id: ranked[4].id, team2_id: ranked[5].id },
    { event_id: eventId, phase: 'final', match_order: 4, team1_id: ranked[6].id, team2_id: ranked[7].id },
  ]

  const { error } = await supabaseAdmin
    .from('team_tournament_matches')
    .insert(inserts)
  if (error) {
    return NextResponse.json(
      { error: 'Failed to insert finals: ' + error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
