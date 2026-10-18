import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'
import { getLevel } from '@/lib/quiz-questions'
import { finalsMatches, finalsPlacements } from '@/lib/americano-format'

export const dynamic = 'force-dynamic'

function bonusForRank(rank: number): number {
  if (rank === 1) return 80
  if (rank === 2) return 50
  if (rank === 3) return 30
  if (rank >= 4 && rank <= 6) return 10
  if (rank >= 7 && rank <= 9) return -10
  return -25 // 10-12
}

export async function POST(req: Request) {
  try {
    const { tournamentId, roundNumber, eventId } = await req.json()
    console.log('END-ROUND:', { tournamentId, roundNumber, eventId })

    const denied = await adminGuard()
    if (denied) return denied

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Round'u bul
    const { data: round, error: roundErr } = await supabase
      .from('tournament_rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round_number', roundNumber)
      .single()
    if (roundErr) throw roundErr

    // The finals is always the last round, whatever the format's round count
    const { data: lastRound, error: lastErr } = await supabase
      .from('tournament_rounds')
      .select('round_number')
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: false })
      .limit(1)
      .single()
    if (lastErr) throw lastErr
    const finalRound: number = lastRound.round_number

    // Round'un maçlarını al
    const { data: matches, error: matchesErr } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('round_id', round.id)
    if (matchesErr) throw matchesErr
    if (!matches || matches.length === 0) {
      return NextResponse.json({ error: 'No matches for this round' }, { status: 400 })
    }
    if (matches.some(m => m.team1_score === null || m.team2_score === null)) {
      return NextResponse.json({ error: 'All scores must be entered' }, { status: 400 })
    }

    // Round'u bitir — claimed first and only once, so a second click (or a retry)
    // can never apply round totals or finals bonuses twice
    const { data: finData, error: finErr } = await supabase
      .from('tournament_rounds')
      .update({ status: 'completed' })
      .eq('id', round.id)
      .neq('status', 'completed')
      .select()
    if (finErr) throw finErr
    const finAffected = finData?.length ?? 0
    console.log('END-ROUND round update affected rows:', finAffected)
    if (finAffected === 0) {
      return NextResponse.json({ error: 'Round already ended' }, { status: 409 })
    }

    // Oyuncu puanlarını topla — keyed by player UUID
    const { data: players, error: playersErr } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournamentId)
    if (playersErr) throw playersErr
    if (!players) throw new Error('No players found')

    // Averaj sistemi: fark = team1_score - team2_score
    // Team1 oyuncuları +fark, Team2 oyuncuları -fark alır
    const updates: Record<string, { games: number; played: number }> = {}
    for (const m of matches) {
      const t1 = m.team1_score
      const t2 = m.team2_score
      const diff = t1 - t2

      for (const p of [m.team1_player1, m.team1_player2]) {
        if (!updates[p]) updates[p] = { games: 0, played: 0 }
        updates[p].games += diff
        updates[p].played += 1
      }
      for (const p of [m.team2_player1, m.team2_player2]) {
        if (!updates[p]) updates[p] = { games: 0, played: 0 }
        updates[p].games += -diff
        updates[p].played += 1
      }
    }
    for (const player of players) {
      const u = updates[player.id]
      if (u) {
        const { error: uErr } = await supabase
          .from('tournament_players')
          .update({
            total_games_won: (player.total_games_won ?? 0) + u.games,
            games_played: (player.games_played ?? 0) + u.played,
          })
          .eq('id', player.id)
        if (uErr) throw uErr
      }
    }

    if (roundNumber === finalRound) {
      // Final round — court-based team scoring

      // tournaments has no event link, so the admin client sends the eventId
      let historyReason = 'Court Americano'
      if (typeof eventId === 'string' && eventId) {
        const { data: ev } = await supabase.from('events').select('name').eq('id', eventId).maybeSingle()
        if (ev?.name) historyReason = ev.name
      }

      // Build player UUID → name map from tournament_players
      const playerNameMap = new Map<string, string>()
      for (const p of players) playerNameMap.set(p.id, p.player_name ?? '')

      for (const match of matches) {
        const courtNum: number = match.court_number
        const entries = finalsPlacements<string>({
          court_number: courtNum,
          team1_score: match.team1_score,
          team2_score: match.team2_score,
          team1: [match.team1_player1, match.team1_player2],
          team2: [match.team2_player1, match.team2_player2],
        }).map(e => ({ id: e.player, playerBonus: e.bonus, rank: e.rank }))

        for (const { id, playerBonus, rank } of entries) {
          const playerName = playerNameMap.get(id) ?? ''
          const parts = playerName.trim().split(/\s+/)
          const firstName = parts[0] ?? ''
          const lastName = parts.slice(1).join(' ')

          if (!firstName) continue

          // Update tournament_players rank
          await supabase
            .from('tournament_players')
            .update({ rank })
            .eq('id', id)

          // Find profile and update skill_score
          let profileQuery = supabase
            .from('profiles')
            .select('id, skill_score, player_code')
            .ilike('first_name', firstName)
          if (lastName) profileQuery = profileQuery.ilike('last_name', lastName)

          const { data: profileMatches, error: profileErr } = await profileQuery
          if (profileErr || !profileMatches || profileMatches.length === 0) {
            console.log(`END-ROUND finals: no profile for "${playerName}"`)
            continue
          }

          const profile = profileMatches[0]
          const current = profile.skill_score ?? 0
          const newScore = current + playerBonus
          const newLevel = getLevel(newScore)

          const { error: updErr } = await supabase
            .from('profiles')
            .update({
              skill_score: newScore,
              skill_level: newLevel,
              last_score_change: playerBonus,
            })
            .eq('id', profile.id)

          if (updErr) {
            console.error(`END-ROUND finals update error for "${playerName}":`, updErr)
          } else {
            console.log(`END-ROUND finals: ${playerName} court=${courtNum} rank=${rank} ${current}→${newScore} (${playerBonus >= 0 ? '+' : ''}${playerBonus})`)
            const { error: histErr } = await supabase.from('score_history').insert({
              user_id: profile.id,
              score: newScore,
              change: playerBonus,
              reason: historyReason,
              tournament_id: tournamentId,
            })
            if (histErr) {
              console.error(`END-ROUND finals score_history insert error for "${playerName}":`, histErr)
            }
          }
        }
      }

      await supabase
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', tournamentId)
      console.log('END-ROUND: tournament finished')
      return NextResponse.json({ success: true, finished: true })
    }

    // Sonraki round'u aktif yap
    const nextNum = roundNumber + 1
    const { data: nextRound, error: nrErr } = await supabase
      .from('tournament_rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round_number', nextNum)
      .single()
    if (nrErr) throw nrErr
    await supabase
      .from('tournament_rounds')
      .update({ status: 'active' })
      .eq('id', nextRound.id)
    await supabase
      .from('tournaments')
      .update({ current_round: nextNum })
      .eq('id', tournamentId)

    // Finals ise sıralamaya göre eşleşme oluştur
    if (nextNum === finalRound) {
      const { data: ranked, error: rankErr } = await supabase
        .from('tournament_players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('total_games_won', { ascending: false })
        .order('player_name', { ascending: true })
      if (rankErr) throw rankErr
      if (!ranked || ranked.length !== 12) throw new Error('Expected 12 ranked players')

      const matches4 = finalsMatches(ranked).map(m => ({
        tournament_id: tournamentId,
        round_id: nextRound.id,
        court_number: m.court,
        team1_player1: m.team1[0].id, // rank N
        team1_player2: m.team1[1].id, // rank N+3
        team2_player1: m.team2[0].id, // rank N+1
        team2_player2: m.team2[1].id, // rank N+2
        status: 'pending',
      }))
      const { error: m4Err } = await supabase.from('tournament_matches').insert(matches4)
      if (m4Err) throw m4Err
      console.log(`END-ROUND: generated R${finalRound} (finals) by ranking`)
    }

    return NextResponse.json({ success: true, nextRound: nextNum })
  } catch (e: any) {
    console.error('END-ROUND ERROR:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
