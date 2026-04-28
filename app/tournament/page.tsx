'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Match = {
  id: string
  court_number: number
  status: string
  team1_score: number | null
  team2_score: number | null
  team1: [string, string]
  team2: [string, string]
}
type Round = {
  id: string
  round_number: number
  status: string
  duration_minutes: number
  matches: Match[]
}
type Player = {
  id: string
  name: string
  total_games_won: number
  games_played: number
  rank: number
}
type State = {
  tournament: {
    id: string
    mode: string
    status: string
    current_round: number
  } | null
  players: Player[]
  rounds: Round[]
}

function rankColor(rank: number): string | undefined {
  if (rank === 1) return '#d4af37'
  if (rank === 2) return '#c0c0c0'
  if (rank === 3) return '#cd7f32'
  return undefined
}

function rankBadge(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

export default function TournamentPage() {
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<number | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/tournament', { cache: 'no-store' })
      const data = await res.json()
      setState(data)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    const supabase = createClient()
    const channel = supabase
      .channel('tournament-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_matches' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_rounds' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_players' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => load()
      )
      .subscribe()

    // Fallback polling — runs even if realtime isn't enabled on the project
    timerRef.current = window.setInterval(load, 10000)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading && !state) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1a3d2e' }}>
        <p className="text-sm text-white/70">Loading...</p>
      </main>
    )
  }

  if (!state?.tournament) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#1a3d2e' }}>
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={80} height={80} className="rounded-full" />
          </div>
          <p className="text-xl font-bold text-white mb-2">Tournament Not Started</p>
          <p className="text-sm text-white/70">Check back when the tournament is live.</p>
          <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: '#ff6b35' }}>
            Back to Tournament Page
          </a>
        </div>
      </main>
    )
  }

  const { tournament, players, rounds } = state
  const currentRound = rounds.find(r => r.round_number === tournament.current_round)
  const isFinished = tournament.status === 'finished'
  const isLive = tournament.status === 'active' || tournament.status === 'live' || tournament.status === 'in_progress'

  return (
    <main className="min-h-screen py-8 px-4 sm:py-12" style={{ backgroundColor: '#1a3d2e' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          <img src="/smashpadel_logo.png" alt="Smash Padel" width={72} height={72} className="rounded-full mb-3" />
          <p className="text-xs tracking-[0.3em] uppercase text-white/60">SmashTorino</p>
          <h1 className="text-2xl font-bold text-white mt-2 text-center">GPadel Tournament</h1>
          <p className="text-xs text-white/60 mt-1">Court Americano</p>
          {isLive && (
            <span
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
              style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: '#ef4444', animation: 'pulse 1.5s infinite' }}
              />
              Live
            </span>
          )}
        </div>

        <div
          className="rounded-xl px-5 py-4 mb-6 text-center"
          style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {isFinished ? (
            <>
              <p className="text-xs tracking-[0.25em] uppercase font-semibold" style={{ color: '#ff6b35' }}>
                Tournament Finished
              </p>
              <p className="text-sm text-white/80 mt-1">Final standings below</p>
            </>
          ) : (
            <>
              <p className="text-xs tracking-[0.25em] uppercase font-semibold" style={{ color: '#ff6b35' }}>
                Round {tournament.current_round} / 4
              </p>
              <p className="text-sm text-white/80 mt-1">
                {currentRound?.duration_minutes ?? 20} minutes ·{' '}
                {tournament.current_round < 4 ? 'Group Stage' : 'Final Round'}
              </p>
            </>
          )}
        </div>

        {!isFinished && currentRound && currentRound.matches.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-white/90 mb-3">Current Matches</h2>
            <div className="space-y-3">
              {currentRound.matches.map(m => (
                <div
                  key={m.id}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ff6b35' }}>
                      Court {m.court_number}
                    </p>
                    {m.team1_score !== null && m.team2_score !== null && (
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
                        Final
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white leading-snug">{m.team1[0]}</p>
                      <p className="text-sm font-semibold text-white leading-snug">{m.team1[1]}</p>
                    </div>
                    <div className="px-3 py-2 rounded-lg text-center min-w-[72px]" style={{ backgroundColor: '#1a3d2e' }}>
                      <p className="text-lg font-bold text-white tabular-nums">
                        {m.team1_score ?? '—'}
                        <span className="text-white/40 mx-1">:</span>
                        {m.team2_score ?? '—'}
                      </p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-semibold text-white leading-snug">{m.team2[0]}</p>
                      <p className="text-sm font-semibold text-white leading-snug">{m.team2[1]}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white/90 mb-3">
            {isFinished ? 'Final Standings' : 'Live Standings'}
          </h2>
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/60 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 text-left font-semibold">#</th>
                  <th className="py-3 px-2 text-left font-semibold">Player</th>
                  <th className="py-3 px-2 text-right font-semibold">+/-</th>
                  <th className="py-3 px-3 text-right font-semibold">MP</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => {
                  const color = rankColor(p.rank)
                  const diff = p.total_games_won
                  const diffColor = diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : 'rgba(255,255,255,0.7)'
                  const diffLabel = diff > 0 ? `+${diff}` : String(diff)
                  return (
                    <tr key={p.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <td className="py-3 px-3">
                        <span
                          className="inline-flex items-center justify-center min-w-[28px] h-7 rounded-full text-xs font-bold"
                          style={{
                            backgroundColor: color || 'rgba(255,255,255,0.06)',
                            color: color ? '#1a3d2e' : '#fff',
                          }}
                        >
                          {rankBadge(p.rank)}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-semibold text-white">{p.name}</td>
                      <td
                        className="py-3 px-2 text-right tabular-nums font-bold"
                        style={{ color: diffColor }}
                      >
                        {diffLabel}
                      </td>
                      <td className="py-3 px-3 text-right text-white/60 tabular-nums">{p.games_played}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white/90 mb-3">All Rounds</h2>
          <div className="space-y-4">
            {rounds.map(r => (
              <div
                key={r.id}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                >
                  <p className="text-sm font-semibold text-white">
                    Round {r.round_number}{' '}
                    {r.round_number === 4 && <span className="text-xs text-white/50">(Final)</span>}
                  </p>
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        r.status === 'active'
                          ? '#ff6b35'
                          : r.status === 'completed'
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(255,255,255,0.04)',
                      color: r.status === 'active' ? '#fff' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {r.status}
                  </span>
                </div>
                {r.matches.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-white/50">Matches will appear when this round starts.</p>
                ) : (
                  <div>
                    {r.matches.map(m => (
                      <div
                        key={m.id}
                        className="px-4 py-3 flex items-center gap-3 border-t"
                        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest w-12" style={{ color: '#ff6b35' }}>
                          C{m.court_number}
                        </p>
                        <div className="flex-1 text-xs text-white/85 leading-tight">
                          {m.team1[0]} + {m.team1[1]}
                        </div>
                        <div className="text-xs font-bold text-white tabular-nums min-w-[46px] text-center">
                          {m.team1_score ?? '—'}:{m.team2_score ?? '—'}
                        </div>
                        <div className="flex-1 text-xs text-white/85 leading-tight text-right">
                          {m.team2[0]} + {m.team2[1]}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 text-center">
          <a href="/" className="text-xs text-white/50 underline">Back to Tournament Page</a>
        </div>
      </div>
    </main>
  )
}
