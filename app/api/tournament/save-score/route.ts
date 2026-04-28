import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { password, matchId, team1Score, team2Score } = await req.json()
    console.log('SAVE-SCORE:', { matchId, team1Score, team2Score })

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
