import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'
import { finalsMatches, isValidSeeding, regularStandings } from '@/lib/americano-format'

export const dynamic = 'force-dynamic'

// Creates the finals (last round) matches once every regular match has a score.
// Seeding = regular-round point differential, then games won; the admin resolves
// any remaining ties by sending the full seeding order.
export async function POST(req: Request) {
  try {
    const { tournamentId, order } = await req.json()
    console.log('GENERATE-FINALS:', { tournamentId, order })

    const denied = await adminGuard()
    if (denied) return denied
    if (!tournamentId || typeof tournamentId !== 'string') {
      return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('id, status')
      .eq('id', tournamentId)
      .single()
    if (tErr) throw tErr
    if (tournament.status !== 'active') {
      return NextResponse.json({ error: 'Tournament is not active' }, { status: 409 })
    }

    const [{ data: rounds, error: rErr }, { data: matches, error: mErr }, { data: players, error: pErr }] =
      await Promise.all([
        supabase.from('tournament_rounds').select('*').eq('tournament_id', tournamentId),
        supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId),
        supabase.from('tournament_players').select('*').eq('tournament_id', tournamentId),
      ])
    if (rErr) throw rErr
    if (mErr) throw mErr
    if (pErr) throw pErr
    if (!rounds?.length || !matches || !players) throw new Error('Tournament data missing')
    if (players.length !== 12) throw new Error('Expected 12 players')

    const finalRoundNumber = Math.max(...rounds.map(r => r.round_number))
    const finalsRound = rounds.find(r => r.round_number === finalRoundNumber)!
    const regularRoundIds = new Set(rounds.filter(r => r.round_number < finalRoundNumber).map(r => r.id))
    const regularMatches = matches.filter(m => regularRoundIds.has(m.round_id))

    if (matches.some(m => m.round_id === finalsRound.id)) {
      return NextResponse.json({ error: 'Finals already generated' }, { status: 409 })
    }
    const expected = regularRoundIds.size * 3
    if (regularMatches.length !== expected) {
      return NextResponse.json({ error: `Expected ${expected} regular matches, found ${regularMatches.length}` }, { status: 400 })
    }
    const missing = regularMatches.filter(m => m.team1_score === null || m.team2_score === null).length
    if (missing > 0) {
      return NextResponse.json({ error: `${missing} regular match(es) still need a score` }, { status: 400 })
    }

    const standings = regularStandings(
      players.map(p => ({ id: p.id, name: p.player_name ?? '' })),
      regularMatches
    )
    const hasTies = standings.some(s => s.tieGroup !== null)
    let orderIds: string[]
    if (Array.isArray(order)) {
      orderIds = order
    } else if (!hasTies) {
      orderIds = standings.map(s => s.id)
    } else {
      return NextResponse.json({ error: 'Ties need a seeding order' }, { status: 409 })
    }
    if (!isValidSeeding(standings, orderIds)) {
      return NextResponse.json(
        { error: 'Seeding order does not match the standings (scores may have changed). Reload and try again.' },
        { status: 409 }
      )
    }

    // Claim the finals round first so a double click can't create two sets of matches
    const { data: claimed, error: cErr } = await supabase
      .from('tournament_rounds')
      .update({ status: 'active' })
      .eq('id', finalsRound.id)
      .eq('status', 'pending')
      .select('id')
    if (cErr) throw cErr
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ error: 'Finals already generated' }, { status: 409 })
    }

    const byId = new Map(players.map(p => [p.id, p]))
    const ranked = orderIds.map(id => byId.get(id)!)
    const finals = finalsMatches(ranked).map(m => ({
      tournament_id: tournamentId,
      round_id: finalsRound.id,
      court_number: m.court,
      team1_player1: m.team1[0].id, // rank N
      team1_player2: m.team1[1].id, // rank N+3
      team2_player1: m.team2[0].id, // rank N+1
      team2_player2: m.team2[1].id, // rank N+2
      status: 'pending',
    }))
    const { error: fErr } = await supabase.from('tournament_matches').insert(finals)
    if (fErr) {
      await supabase.from('tournament_rounds').update({ status: 'pending' }).eq('id', finalsRound.id)
      throw fErr
    }

    // Record the regular-round totals on the players (display only; nothing reads them for seeding)
    const standingById = new Map(standings.map(s => [s.id, s]))
    for (const p of players) {
      const s = standingById.get(p.id)!
      await supabase
        .from('tournament_players')
        .update({ total_games_won: s.diff, games_played: s.played })
        .eq('id', p.id)
    }
    await supabase
      .from('tournament_rounds')
      .update({ status: 'completed' })
      .in('id', Array.from(regularRoundIds))
    await supabase
      .from('tournaments')
      .update({ current_round: finalRoundNumber })
      .eq('id', tournamentId)

    console.log('GENERATE-FINALS: created', finals.length, 'finals matches')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('GENERATE-FINALS ERROR:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
