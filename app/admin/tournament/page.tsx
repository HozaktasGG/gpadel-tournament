'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useAdmin } from '../admin-provider'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Tournament = {
  id: string
  mode: string
  status: string
  current_round: number
}
type DBRound = {
  id: string
  tournament_id: string
  round_number: number
  status: string
  duration_minutes: number
}
type DBMatch = {
  id: string
  tournament_id: string
  round_id: string
  court_number: number
  status: string
  team1_score: number | null
  team2_score: number | null
  team1_player1: string
  team1_player2: string
  team2_player1: string
  team2_player2: string
}
type DBPlayer = {
  id: string
  tournament_id: string
  player_index: number
  player_name: string
  total_games_won: number | null
  games_played: number | null
}

export default function AdminTournamentPage() {
  const { password } = useAdmin()
  const authed = !!password

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [rounds, setRounds] = useState<DBRound[]>([])
  const [matches, setMatches] = useState<DBMatch[]>([])
  const [players, setPlayers] = useState<DBPlayer[]>([])

  const [registeredCount, setRegisteredCount] = useState<number | null>(null)
  const [scoreInputs, setScoreInputs] = useState<Record<string, { t1: string; t2: string }>>({})
  const [busy, setBusy] = useState(false)
  const [busyMatchId, setBusyMatchId] = useState('')
  const [savedMatchId, setSavedMatchId] = useState('')
  const [loaded, setLoaded] = useState(false)
  const pollRef = useRef<number | null>(null)
  const countLoadedRef = useRef(false)

  const loadAll = useCallback(async () => {
    const { data: t, error: tErr } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (tErr) console.error('LOAD tournaments error:', tErr)

    if (!t) {
      setTournament(null)
      setRounds([])
      setMatches([])
      setPlayers([])
      setLoaded(true)
      return
    }

    const [{ data: rs, error: rErr }, { data: ms, error: mErr }, { data: ps, error: pErr }] =
      await Promise.all([
        supabase
          .from('tournament_rounds')
          .select('*')
          .eq('tournament_id', t.id)
          .order('round_number', { ascending: true }),
        supabase
          .from('tournament_matches')
          .select('*')
          .eq('tournament_id', t.id)
          .order('court_number', { ascending: true }),
        supabase
          .from('tournament_players')
          .select('*')
          .eq('tournament_id', t.id)
          .order('player_index', { ascending: true }),
      ])
    if (rErr) console.error('LOAD rounds error:', rErr)
    if (mErr) console.error('LOAD matches error:', mErr)
    if (pErr) console.error('LOAD players error:', pErr)

    setTournament(t as Tournament)
    setRounds((rs as DBRound[]) ?? [])
    setMatches((ms as DBMatch[]) ?? [])
    setPlayers((ps as DBPlayer[]) ?? [])
    setLoaded(true)
    console.log('LOAD ALL:', {
      tournament: t?.id,
      rounds: rs?.length,
      matches: ms?.length,
      players: ps?.length,
    })
  }, [])

  const loadRegisteredCount = useCallback(async () => {
    if (countLoadedRef.current) return
    countLoadedRef.current = true
    const { data: ev } = await supabase
      .from('events')
      .select('id')
      .eq('date', '2026-04-24')
      .maybeSingle()
    if (!ev) { setRegisteredCount(0); return }
    const { count } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', ev.id)
      .eq('status', 'approved')
    setRegisteredCount(count ?? 0)
  }, [])

  useEffect(() => {
    if (!authed) return
    loadRegisteredCount()
    loadAll()
    pollRef.current = window.setInterval(loadAll, 5000)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [authed, loadAll, loadRegisteredCount])

  // Seed score inputs when matches arrive (don't clobber typing)
  useEffect(() => {
    if (matches.length === 0) return
    setScoreInputs(prev => {
      const next = { ...prev }
      for (const m of matches) {
        if (!next[m.id]) {
          next[m.id] = {
            t1: m.team1_score != null ? String(m.team1_score) : '',
            t2: m.team2_score != null ? String(m.team2_score) : '',
          }
        }
      }
      return next
    })
  }, [matches])

  const playerById = new Map(players.map(p => [p.id, p]))
  const nameOf = (id: string) => playerById.get(id)?.player_name ?? '—'

  const currentRound = rounds.find(r => r.round_number === tournament?.current_round)
  const currentMatches = currentRound
    ? matches
        .filter(m => m.round_id === currentRound.id)
        .sort((a, b) => a.court_number - b.court_number)
    : []

  const canEndRound =
    !!currentRound &&
    currentMatches.length > 0 &&
    currentMatches.every(m => m.team1_score !== null && m.team2_score !== null)

  const rankedPlayers = [...players]
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

  const handleStart = async () => {
    const count = registeredCount ?? 0
    if (!confirm(`Start tournament with ${count} registered players?`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/tournament/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      console.log('START RESPONSE:', res.status, data)
      if (!res.ok) {
        alert('ERROR: ' + JSON.stringify(data))
        return
      }
      await loadAll()
    } catch (err: any) {
      alert('Network error: ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const handleSaveScore = async (matchId: string) => {
    const vals = scoreInputs[matchId]
    if (!vals || vals.t1 === '' || vals.t2 === '') {
      alert('Enter both scores.')
      return
    }
    const t1 = Number(vals.t1)
    const t2 = Number(vals.t2)
    if (!Number.isFinite(t1) || !Number.isFinite(t2)) {
      alert('Scores must be numbers.')
      return
    }
    console.log('SAVE SCORE:', { matchId, t1, t2 })
    setBusyMatchId(matchId)
    try {
      const res = await fetch('/api/tournament/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, matchId, team1Score: t1, team2Score: t2 }),
      })
      const data = await res.json()
      console.log('SAVE-SCORE RESPONSE:', res.status, data)
      if (!res.ok) {
        alert('ERROR: ' + JSON.stringify(data))
        return
      }
      setSavedMatchId(matchId)
      window.setTimeout(() => {
        setSavedMatchId(prev => (prev === matchId ? '' : prev))
      }, 2000)
      await loadAll()
    } catch (err: any) {
      alert('Network error: ' + (err?.message || String(err)))
    } finally {
      setBusyMatchId('')
    }
  }

  const handleEndRound = async () => {
    if (!tournament) return
    const num = tournament.current_round
    console.log('END ROUND:', num)
    setBusy(true)
    try {
      const res = await fetch('/api/tournament/end-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          tournamentId: tournament.id,
          roundNumber: num,
        }),
      })
      const data = await res.json()
      console.log('END-ROUND RESPONSE:', res.status, data)
      if (!res.ok) {
        alert('ERROR: ' + JSON.stringify(data))
        return
      }
      await loadAll()
    } catch (err: any) {
      alert('Network error: ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset tournament? All players, rounds, and scores will be deleted.')) return
    console.log('RESET')
    setBusy(true)
    try {
      const res = await fetch('/api/tournament/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      console.log('RESET RESPONSE:', res.status, data)
      if (!res.ok) {
        alert('ERROR: ' + JSON.stringify(data))
        return
      }
      setScoreInputs({})
      await loadAll()
    } catch (err: any) {
      alert('Network error: ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center p-6">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white p-6 sm:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={44} height={44} className="rounded-full" />
            <h1 className="text-lg font-bold text-black">Tournament Admin</h1>
          </div>
          <div className="flex gap-4">
            <a href="/admin" className="text-sm text-gray-500 hover:text-black">← Admin</a>
            <a href="/tournament" className="text-sm text-gray-500 hover:text-black">Public ↗</a>
          </div>
        </div>

        {/* NO TOURNAMENT — CREATE UI */}
        {!tournament && (
          <section>
            <h2 className="text-sm font-semibold text-black mb-3">New Tournament</h2>
            <p className="text-xs text-gray-500 mb-4">
              Court Americano. 12 players, 3 courts, 4 rounds. Players are fetched automatically from the 2026-04-24 event registrations.
            </p>

            <div
              className="rounded-xl px-4 py-3 mb-5 text-sm"
              style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
            >
              <span className="font-semibold text-green-800">
                {registeredCount === null
                  ? 'Loading registered players...'
                  : `${registeredCount} registered player${registeredCount !== 1 ? 's' : ''} found for 2026-04-24`}
              </span>
              {registeredCount !== null && registeredCount !== 12 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠ Tournament requires exactly 12 players.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={busy || registeredCount !== 12}
              className="w-full py-5 rounded-xl text-lg font-extrabold text-white disabled:opacity-50 shadow-lg"
              style={{ backgroundColor: '#ff6b35' }}
            >
              {busy ? 'Drawing...' : '🎲 KURA — Draw & Start Tournament'}
            </button>
          </section>
        )}

        {/* TOURNAMENT ACTIVE / FINISHED */}
        {tournament && (
          <>
            <div className="mb-6 rounded-xl p-5" style={{ backgroundColor: '#0f2a1f', color: '#fff' }}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[11px] tracking-[0.25em] uppercase text-white/60">
                    Court Americano
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {tournament.status === 'finished'
                      ? 'Tournament Finished'
                      : `Round ${tournament.current_round} / 4`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={busy}
                  className="text-xs font-bold px-4 py-2 rounded disabled:opacity-50"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* CURRENT ROUND MATCHES */}
            {tournament.status === 'active' && currentRound && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-black mb-3">
                  Round {currentRound.round_number} — Matches
                </h2>
                {currentMatches.length === 0 ? (
                  <p className="text-xs text-gray-500">No matches for this round yet.</p>
                ) : (
                  <div className="space-y-3">
                    {currentMatches.map(m => {
                      const input = scoreInputs[m.id] ?? { t1: '', t2: '' }
                      const scored = m.team1_score !== null && m.team2_score !== null
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl p-4 border"
                          style={{
                            borderColor: scored ? '#1a3d2e' : '#e5e7eb',
                            backgroundColor: scored ? '#f0fdf4' : '#fff',
                          }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ff6b35' }}>
                              Court {m.court_number}
                            </p>
                            {scored && (
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-green-700">
                                Saved
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-black leading-snug">{nameOf(m.team1_player1)}</p>
                              <p className="text-sm font-semibold text-black leading-snug">{nameOf(m.team1_player2)}</p>
                            </div>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={input.t1}
                              onChange={e =>
                                setScoreInputs(prev => ({
                                  ...prev,
                                  [m.id]: { ...input, t1: e.target.value },
                                }))
                              }
                              className="w-14 text-center text-lg font-bold border border-gray-300 rounded py-2 outline-none focus:border-black"
                            />
                            <span className="text-gray-400">:</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={input.t2}
                              onChange={e =>
                                setScoreInputs(prev => ({
                                  ...prev,
                                  [m.id]: { ...input, t2: e.target.value },
                                }))
                              }
                              className="w-14 text-center text-lg font-bold border border-gray-300 rounded py-2 outline-none focus:border-black"
                            />
                            <div className="flex-1 text-right">
                              <p className="text-sm font-semibold text-black leading-snug">{nameOf(m.team2_player1)}</p>
                              <p className="text-sm font-semibold text-black leading-snug">{nameOf(m.team2_player2)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              console.log('BUTTON CLICKED for match:', m.id)
                              handleSaveScore(m.id)
                            }}
                            className="mt-3 w-full py-2 rounded text-xs font-semibold text-white"
                            style={{
                              backgroundColor: savedMatchId === m.id ? '#16a34a' : '#1a3d2e',
                            }}
                          >
                            {busyMatchId === m.id
                              ? 'Saving...'
                              : savedMatchId === m.id
                              ? '✓ Saved!'
                              : scored
                              ? 'Update Score'
                              : 'Save Score'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleEndRound}
                  disabled={busy || !canEndRound}
                  className="mt-5 w-full py-3.5 rounded-lg text-sm font-bold text-white disabled:opacity-40"
                  style={{ backgroundColor: '#ff6b35' }}
                >
                  {busy
                    ? '...'
                    : currentRound.round_number === 4
                    ? 'End Tournament'
                    : currentRound.round_number === 3
                    ? 'End Round & Start Final'
                    : 'End Round & Next Round'}
                </button>
                {!canEndRound && currentMatches.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    Save every court score first.
                  </p>
                )}
              </section>
            )}

            {/* RANKINGS */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-black mb-3">
                {tournament.status === 'finished' ? 'Final Standings' : 'Live Rankings'}
              </h2>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-gray-500 text-[11px] uppercase tracking-wider">
                      <th className="py-2 px-3 text-left font-semibold">#</th>
                      <th className="py-2 px-2 text-left font-semibold">Player</th>
                      <th className="py-2 px-2 text-right font-semibold">+/-</th>
                      <th className="py-2 px-3 text-right font-semibold">MP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedPlayers.map(p => {
                      const diff = p.total_games_won
                      const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#6b7280'
                      const diffLabel = diff > 0 ? `+${diff}` : String(diff)
                      return (
                        <tr key={p.id} className="border-t border-gray-100">
                          <td className="py-2 px-3 font-bold text-black">{p.rank}</td>
                          <td className="py-2 px-2 font-semibold text-black">{p.name}</td>
                          <td
                            className="py-2 px-2 text-right tabular-nums font-bold"
                            style={{ color: diffColor }}
                          >
                            {diffLabel}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-600">{p.games_played}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* FULL FIXTURE — all rounds, all courts */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-black mb-3">Full Fixture</h2>
              <div className="space-y-4">
                {rounds.map(r => {
                  const rMatches = matches
                    .filter(m => m.round_id === r.id)
                    .sort((a, b) => a.court_number - b.court_number)
                  return (
                    <div
                      key={r.id}
                      className="border border-gray-200 rounded-xl overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between px-4 py-2.5"
                        style={{ backgroundColor: '#f9fafb' }}
                      >
                        <p className="text-sm font-bold text-black">
                          Round {r.round_number}
                          {r.round_number === 4 && (
                            <span className="ml-2 text-xs font-normal text-gray-500">(Final — by ranking)</span>
                          )}
                        </p>
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor:
                              r.status === 'active'
                                ? '#ff6b35'
                                : r.status === 'completed'
                                ? '#1a3d2e'
                                : '#e5e7eb',
                            color: r.status === 'pending' ? '#6b7280' : '#fff',
                          }}
                        >
                          {r.status}
                        </span>
                      </div>
                      {rMatches.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-500">
                          {r.round_number === 4
                            ? 'Generated after Round 3 by ranking.'
                            : 'No matches.'}
                        </p>
                      ) : (
                        rMatches.map(m => (
                          <div
                            key={m.id}
                            className="px-4 py-3 flex items-center gap-3 border-t border-gray-100"
                          >
                            <p
                              className="text-[10px] font-bold uppercase tracking-widest w-10"
                              style={{ color: '#ff6b35' }}
                            >
                              C{m.court_number}
                            </p>
                            <div className="flex-1 text-xs text-black leading-tight">
                              {nameOf(m.team1_player1)} + {nameOf(m.team1_player2)}
                            </div>
                            <div className="text-xs font-bold text-black tabular-nums min-w-[46px] text-center">
                              {m.team1_score ?? '—'}:{m.team2_score ?? '—'}
                            </div>
                            <div className="flex-1 text-xs text-black leading-tight text-right">
                              {nameOf(m.team2_player1)} + {nameOf(m.team2_player2)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
