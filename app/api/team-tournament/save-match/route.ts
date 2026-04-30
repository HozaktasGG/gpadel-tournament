import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type MatchRow = {
  id: string
  event_id: string
  phase: 'group' | 'quarter' | 'semi' | 'final'
  match_order: number | null
  team1_id: string | null
  team2_id: string | null
}

export async function POST(req: NextRequest) {
  let body: { password?: string; matchId?: string; team1Score?: number; team2Score?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const matchId = body.matchId?.trim()
  const t1 = body.team1Score
  const t2 = body.team2Score
  if (!matchId || typeof t1 !== 'number' || typeof t2 !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid fields.' }, { status: 400 })
  }
  if (t1 === t2) {
    return NextResponse.json({ error: 'Draws are not allowed.' }, { status: 400 })
  }

  const { data: match } = await supabaseAdmin
    .from('team_tournament_matches')
    .select('id, event_id, phase, match_order, team1_id, team2_id')
    .eq('id', matchId)
    .maybeSingle<MatchRow>()

  if (!match) {
    return NextResponse.json({ error: 'Match not found.' }, { status: 404 })
  }
  if (!match.team1_id || !match.team2_id) {
    return NextResponse.json({ error: 'Match teams not yet decided.' }, { status: 400 })
  }

  const winnerId = t1 > t2 ? match.team1_id : match.team2_id

  const { error: updateErr } = await supabaseAdmin
    .from('team_tournament_matches')
    .update({
      team1_score: t1,
      team2_score: t2,
      winner_id: winnerId,
    })
    .eq('id', matchId)

  if (updateErr) {
    return NextResponse.json({ error: 'Update failed: ' + updateErr.message }, { status: 500 })
  }

  // Auto-advance for knockout phases
  if (match.phase === 'quarter' && match.match_order != null) {
    const sfOrder = Math.ceil(match.match_order / 2)
    const slot: 'team1_id' | 'team2_id' = match.match_order % 2 === 1 ? 'team1_id' : 'team2_id'
    await supabaseAdmin
      .from('team_tournament_matches')
      .update({ [slot]: winnerId })
      .eq('event_id', match.event_id)
      .eq('phase', 'semi')
      .eq('match_order', sfOrder)
  } else if (match.phase === 'semi' && match.match_order != null) {
    const slot: 'team1_id' | 'team2_id' = match.match_order === 1 ? 'team1_id' : 'team2_id'
    await supabaseAdmin
      .from('team_tournament_matches')
      .update({ [slot]: winnerId })
      .eq('event_id', match.event_id)
      .eq('phase', 'final')
      .eq('match_order', 1)
  }

  return NextResponse.json({ success: true })
}
