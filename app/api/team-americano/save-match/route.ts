import { NextRequest, NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { TA_FORMAT, readJson } from '@/lib/team-americano-server'

type MatchRow = {
  id: string
  event_id: string
  phase: string
  team1_id: string | null
  team2_id: string | null
  event: { format: string | null } | null
}

const validGames = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99

// Saves games per team. Draws are allowed in group rounds, not in the finals.
export async function POST(req: NextRequest) {
  const body = await readJson<{ matchId?: string; team1Score?: unknown; team2Score?: unknown }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const denied = await adminGuard()
  if (denied) return denied

  const matchId = body.matchId?.trim()
  const t1 = body.team1Score
  const t2 = body.team2Score
  if (!matchId || !validGames(t1) || !validGames(t2)) {
    return NextResponse.json({ error: 'Games must be whole numbers between 0 and 99.' }, { status: 400 })
  }

  const { data: match } = await supabaseAdmin
    .from('team_tournament_matches')
    .select('id, event_id, phase, team1_id, team2_id, event:events(format)')
    .eq('id', matchId)
    .maybeSingle<MatchRow>()
  if (!match) return NextResponse.json({ error: 'Match not found.' }, { status: 404 })
  if (match.event?.format !== TA_FORMAT) {
    return NextResponse.json({ error: 'This match is not part of a Team Americano event.' }, { status: 400 })
  }
  if (!match.team1_id || !match.team2_id) {
    return NextResponse.json({ error: 'Match teams not yet decided.' }, { status: 400 })
  }
  if (match.phase === 'final' && t1 === t2) {
    return NextResponse.json({ error: 'Finals need a winner — draws are not allowed.' }, { status: 400 })
  }

  const winnerId = t1 === t2 ? null : t1 > t2 ? match.team1_id : match.team2_id
  const { error } = await supabaseAdmin
    .from('team_tournament_matches')
    .update({ team1_score: t1, team2_score: t2, winner_id: winnerId })
    .eq('id', matchId)
  if (error) return NextResponse.json({ error: 'Update failed: ' + error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
