import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ZERO = '00000000-0000-0000-0000-000000000000'

export async function POST(req: Request) {
  try {
    const { password, eventId } = await req.json()

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }
    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
      .select('id, first_name, last_name')
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

    // Create 4 rounds
    const { data: rounds, error: re } = await supabase
      .from('tournament_rounds')
      .insert(
        [1, 2, 3, 4].map(n => ({
          tournament_id: t.id,
          round_number: n,
          duration_minutes: n === 4 ? 30 : 20,
          status: n === 1 ? 'active' : 'pending',
        }))
      )
      .select()
    if (re) throw re
    if (!rounds) throw new Error('Rounds insert returned no rows')

    const pairKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`)
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }

    const generateRoundMatching = (used: Set<string>): [number, number][] | null => {
      const playerIdx = Array.from({ length: 12 }, (_, i) => i)
      for (let attempt = 0; attempt < 1000; attempt++) {
        const order = shuffle(playerIdx)
        const pairs: [number, number][] = []
        let ok = true
        for (let i = 0; i < 12; i += 2) {
          const a = order[i], b = order[i + 1]
          if (used.has(pairKey(a, b))) { ok = false; break }
          pairs.push([a, b])
        }
        if (ok) return pairs
      }
      return null
    }

    let roundPairs: [number, number][][] | null = null
    for (let bigAttempt = 0; bigAttempt < 200; bigAttempt++) {
      const used = new Set<string>()
      const attempt: [number, number][][] = []
      let ok = true
      for (let r = 0; r < 3; r++) {
        const m = generateRoundMatching(used)
        if (!m) { ok = false; break }
        m.forEach(([a, b]) => used.add(pairKey(a, b)))
        attempt.push(m)
      }
      if (ok) { roundPairs = attempt; break }
    }
    if (!roundPairs) throw new Error('Could not generate unique-partner schedule')

    const matches: any[] = []
    for (let r = 0; r < 3; r++) {
      const round = rounds.find(x => x.round_number === r + 1)
      if (!round) throw new Error(`Round ${r + 1} missing`)
      const shuffledPairs = shuffle(roundPairs[r])
      for (let c = 0; c < 3; c++) {
        const team1 = shuffledPairs[c * 2]
        const team2 = shuffledPairs[c * 2 + 1]
        matches.push({
          tournament_id: t.id,
          round_id: round.id,
          court_number: c + 1,
          team1_player1: idByIndex.get(team1[0])!,
          team1_player2: idByIndex.get(team1[1])!,
          team2_player1: idByIndex.get(team2[0])!,
          team2_player2: idByIndex.get(team2[1])!,
          status: 'pending',
        })
      }
    }
    const { error: me } = await supabase.from('tournament_matches').insert(matches)
    if (me) throw me

    console.log('START: created tournament', t.id, 'with', matches.length, 'matches')
    return NextResponse.json({ success: true, tournamentId: t.id, playerCount: players.length })
  } catch (e: any) {
    console.error('START ERROR:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
