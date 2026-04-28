import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tournament) {
    return NextResponse.json({ tournament: null, players: [], rounds: [] })
  }

  const [playersRes, roundsRes, matchesRes] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('player_index', { ascending: true }),
    supabase
      .from('tournament_rounds')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('round_number', { ascending: true }),
    supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('court_number', { ascending: true }),
  ])

  const players = playersRes.data ?? []
  const playerById = new Map(players.map(p => [p.id, p]))

  const rounds = (roundsRes.data ?? []).map(round => {
    const roundMatches = (matchesRes.data ?? [])
      .filter(m => m.round_id === round.id)
      .sort((a, b) => a.court_number - b.court_number)
      .map(m => ({
        id: m.id,
        court_number: m.court_number,
        status: m.status,
        team1_score: m.team1_score,
        team2_score: m.team2_score,
        team1: [
          playerById.get(m.team1_player1)?.player_name ?? '—',
          playerById.get(m.team1_player2)?.player_name ?? '—',
        ],
        team2: [
          playerById.get(m.team2_player1)?.player_name ?? '—',
          playerById.get(m.team2_player2)?.player_name ?? '—',
        ],
      }))
    return {
      id: round.id,
      round_number: round.round_number,
      status: round.status,
      duration_minutes: round.duration_minutes,
      matches: roundMatches,
    }
  })

  const ranked = [...players]
    .map(p => ({
      id: p.id,
      name: p.player_name,
      total_games_won: p.total_games_won ?? 0,
      games_played: p.games_played ?? 0,
    }))
    .sort((a, b) => {
      if (b.total_games_won !== a.total_games_won) return b.total_games_won - a.total_games_won
      return a.name.localeCompare(b.name)
    })
    .map((p, i) => ({ ...p, rank: i + 1 }))

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      mode: tournament.mode,
      status: tournament.status,
      current_round: tournament.current_round,
    },
    players: ranked,
    rounds,
  })
}
