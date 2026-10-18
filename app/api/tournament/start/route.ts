import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'
import { americanoFormat, generateRegularRounds, totalRounds } from '@/lib/americano-format'

export const dynamic = 'force-dynamic'

const ZERO = '00000000-0000-0000-0000-000000000000'

export async function POST(req: Request) {
  try {
    const { eventId } = await req.json()

    const denied = await adminGuard()
    if (denied) return denied
    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('format')
      .eq('id', eventId)
      .maybeSingle()
    if (eventError || !eventRow) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const format = americanoFormat(eventRow.format)
    const finalRound = totalRounds(format)

    // Fetch approved registrations for the selected event
    const { data: regRows, error: regError } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .limit(12)

    if (regError || !regRows || regRows.length === 0) {
      return NextResponse.json({ error: 'No approved registrations found' }, { status: 400 })
    }

    const userIds = regRows.map(r => r.user_id)
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, player_code')
      .in('id', userIds)

    if (profileError || !profileRows) {
      return NextResponse.json({ error: 'Failed to load player profiles' }, { status: 500 })
    }

    const profileMap = new Map(profileRows.map(p => [p.id, p]))
    const players = regRows
      .map(r => {
        const p = profileMap.get(r.user_id)
        return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim()
      })
      .filter(n => n.length > 0)

    console.log('START:', { playerCount: players.length, players })

    if (players.length !== 12) {
      return NextResponse.json(
        { error: `Need exactly 12 approved players, found ${players.length}` },
        { status: 400 }
      )
    }

    // Reset existing data
    await supabase.from('tournament_matches').delete().neq('id', ZERO)
    await supabase.from('tournament_rounds').delete().neq('id', ZERO)
    await supabase.from('tournament_players').delete().neq('id', ZERO)
    await supabase.from('tournaments').delete().neq('id', ZERO)

    // Create tournament
    const { data: t, error: te } = await supabase
      .from('tournaments')
      .insert({ mode: 'court', status: 'active', current_round: 1 })
      .select()
      .single()
    if (te) throw te

    // Insert players
    const playerInserts = players.map((name, i) => ({
      tournament_id: t.id,
      player_name: name,
      player_index: i,
      total_games_won: 0,
      games_played: 0,
    }))
    const { data: insertedPlayers, error: pe } = await supabase
      .from('tournament_players')
      .insert(playerInserts)
      .select()
    if (pe) throw pe
    if (!insertedPlayers || insertedPlayers.length !== 12) {
      throw new Error('Player insert did not return 12 rows')
    }
    const idByIndex = new Map<number, string>()
    for (const p of insertedPlayers) idByIndex.set(p.player_index, p.id)

    // Regular rounds + finals round (last)
    const { data: rounds, error: re } = await supabase
      .from('tournament_rounds')
      .insert(
        Array.from({ length: finalRound }, (_, i) => i + 1).map(n => ({
          tournament_id: t.id,
          round_number: n,
          duration_minutes: n === finalRound ? format.finalsMinutes : format.regularRoundMinutes,
          status: n === 1 ? 'active' : 'pending',
        }))
      )
      .select()
    if (re) throw re
    if (!rounds) throw new Error('Rounds insert returned no rows')

    const regularRounds = generateRegularRounds(format.regularRounds)
    const matches: any[] = []
    regularRounds.forEach((roundMatches, r) => {
      const round = rounds.find(x => x.round_number === r + 1)
      if (!round) throw new Error(`Round ${r + 1} missing`)
      for (const { court, team1, team2 } of roundMatches) {
        matches.push({
          tournament_id: t.id,
          round_id: round.id,
          court_number: court,
          team1_player1: idByIndex.get(team1[0])!,
          team1_player2: idByIndex.get(team1[1])!,
          team2_player1: idByIndex.get(team2[0])!,
          team2_player2: idByIndex.get(team2[1])!,
          status: 'pending',
        })
      }
    })
    const { error: me } = await supabase.from('tournament_matches').insert(matches)
    if (me) throw me

    console.log('START: created tournament', t.id, format.name, 'with', matches.length, 'matches')
    return NextResponse.json({ success: true, tournamentId: t.id, playerCount: players.length })
  } catch (e: any) {
    console.error('START ERROR:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
