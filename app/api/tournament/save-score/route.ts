import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { matchId, team1Score, team2Score } = await req.json()
    console.log('SAVE-SCORE:', { matchId, team1Score, team2Score })

    const denied = await adminGuard()
    if (denied) return denied

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Locked once it has been counted: regular scores after the finals are drawn
    // (they decided the seeding), and everything once the tournament is finished
    const { data: match, error: matchErr } = await supabase
      .from('tournament_matches')
      .select('id, tournament_id, round_id')
      .eq('id', matchId)
      .maybeSingle()
    if (matchErr) throw matchErr
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    const [{ data: tournament }, { data: rounds }] = await Promise.all([
      supabase.from('tournaments').select('status').eq('id', match.tournament_id).single(),
      supabase.from('tournament_rounds').select('id, round_number, status').eq('tournament_id', match.tournament_id),
    ])
    if (tournament?.status === 'finished') {
      return NextResponse.json({ error: 'Tournament is finished; scores are locked' }, { status: 409 })
    }
    const finalRound = Math.max(...(rounds ?? []).map(r => r.round_number))
    const finals = rounds?.find(r => r.round_number === finalRound)
    if (finals && match.round_id !== finals.id && finals.status !== 'pending') {
      return NextResponse.json({ error: 'Finals already drawn; regular-round scores are locked' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('tournament_matches')
      .update({
        team1_score: Number(team1Score),
        team2_score: Number(team2Score),
        status: 'completed',
      })
      .eq('id', matchId)
      .select()

    if (error) {
      console.error('SAVE-SCORE DB error:', error)
      throw error
    }
    const affected = data?.length ?? 0
    console.log('SAVE-SCORE affected rows:', affected)
    if (affected === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, affected })
  } catch (e: any) {
    console.error('SAVE-SCORE ERROR:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
