'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useAdmin } from '../admin-provider'

type Team = {
  id: string
  team_name: string
  captain_id: string | null
  partner_id: string | null
}
type Player = {
  id: string
  first_name: string | null
  last_name: string | null
}
type Match = {
  id: string
  phase: 'group' | 'quarter' | 'semi' | 'final'
  round_number: number | null
  team1_id: string | null
  team2_id: string | null
  team1_score: number | null
  team2_score: number | null
  winner_id: string | null
  match_order: number | null
}

type Props = {
  eventId: string
  eventName: string
  onBack: () => void
}

const ROUND_LABELS = ['Round 1', 'Round 2', 'Round 3'] as const
const FINAL_LABELS: Record<number, { title: string; emoji: string }> = {
  1: { title: 'Final', emoji: '🏆' },
  2: { title: '3rd Place', emoji: '🥉' },
  3: { title: '5th Place', emoji: '' },
  4: { title: '7th Place', emoji: '' },
}

export default function TeamAmericanoManager({ eventId, eventName, onBack }: Props) {
  const { password } = useAdmin()
  const supabase = createClient()

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [scoreInputs, setScoreInputs] = useState<Record<string, { t1: string; t2: string }>>({})
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyMatchId, setBusyMatchId] = useState('')

  const loadAll = useCallback(async () => {
    const [teamsRes, matchesRes] = await Promise.all([
      supabase
        .from('team_registrations')
        .select('id, team_name, captain_id, partner_id')
        .eq('event_id', eventId)
        .eq('status', 'approved'),
      supabase
        .from('team_tournament_matches')
        .select('id, phase, round_number, team1_id, team2_id, team1_score, team2_score, winner_id, match_order')
        .eq('event_id', eventId)
        .order('round_number', { ascending: true })
        .order('match_order', { ascending: true }),
    ])

    const teamRows = (teamsRes.data ?? []) as Team[]
    const matchRows = (matchesRes.data ?? []) as Match[]

    const playerIds = teamRows
      .flatMap(t => [t.captain_id, t.partner_id])
      .filter((id): id is string => !!id)

    let playerRows: Player[] = []
    if (playerIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', playerIds)
      playerRows = (data ?? []) as Player[]
    }

    setTeams(teamRows)
    setPlayers(playerRows)
    setMatches(matchRows)
    setLoaded(true)
  }, [eventId, supabase])

  useEffect(() => {
    loadAll()
  }, [loadAll])

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

  const teamById = new Map(teams.map(t => [t.id, t]))
  const playerById = new Map(players.map(p => [p.id, p]))

  const teamLabel = (id: string | null): string => {
    if (!id) return '—'
    return teamById.get(id)?.team_name ?? '—'
  }

  const teamPlayers = (id: string | null): string => {
    if (!id) return ''
    const t = teamById.get(id)
    if (!t) return ''
    const c = playerById.get(t.captain_id ?? '')
    const p = playerById.get(t.partner_id ?? '')
    const name = (x: Player | undefined) =>
      x ? [x.first_name, x.last_name].filter(Boolean).join(' ').trim() : ''
    return [name(c), name(p)].filter(Boolean).join(' & ')
  }

  const groupMatches = matches.filter(m => m.phase === 'group')
  const finalMatches = matches.filter(m => m.phase === 'final')
  const groupStageComplete =
    groupMatches.length === 12 &&
    groupMatches.every(m => m.team1_score !== null && m.team2_score !== null)

  type Standing = {
    team_id: string
    played: number
    wins: number
    losses: number
    diff: number
  }
  const standings: Standing[] = (() => {
    const map = new Map<string, Standing>()
    for (const t of teams) {
      map.set(t.id, { team_id: t.id, played: 0, wins: 0, losses: 0, diff: 0 })
    }
    for (const m of groupMatches) {
      if (m.team1_score == null || m.team2_score == null) continue
      if (!m.team1_id || !m.team2_id) continue
      const a = map.get(m.team1_id)
      const b = map.get(m.team2_id)
      if (!a || !b) continue
      a.played++
      b.played++
      const d = m.team1_score - m.team2_score
      a.diff += d
      b.diff -= d
      if (m.team1_score > m.team2_score) {
        a.wins++
        b.losses++
      } else {
        b.wins++
        a.losses++
      }
    }
    return Array.from(map.values()).sort((x, y) => {
      if (y.diff !== x.diff) return y.diff - x.diff
      if (y.wins !== x.wins) return y.wins - x.wins
      return teamLabel(x.team_id).localeCompare(teamLabel(y.team_id))
    })
  })()

  const showStandings = groupMatches.some(m => m.team1_score != null && m.team2_score != null)

  const handleGenerateSchedule = async () => {
    if (teams.length !== 8) {
      alert(`Need exactly 8 approved teams (you have ${teams.length}).`)
      return
    }
    if (!confirm('Generate the round-robin schedule? 3 rounds × 4 matches with no repeated matchups.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/team-americano/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, eventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('ERROR: ' + (data.error ?? JSON.stringify(data)))
        return
      }
      await loadAll()
    } catch (err) {
      alert('Network error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  const handleSaveMatch = async (matchId: string) => {
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
    if (t1 === t2) {
      alert('Draws are not allowed — one team must win.')
      return
    }
    setBusyMatchId(matchId)
    try {
      const res = await fetch('/api/team-tournament/save-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, matchId, team1Score: t1, team2Score: t2 }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('ERROR: ' + (data.error ?? JSON.stringify(data)))
        return
      }
      await loadAll()
    } catch (err) {
      alert('Network error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusyMatchId('')
    }
  }

  const handleGenerateFinals = async () => {
    if (!confirm('Generate finals matches based on current standings?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/team-americano/generate-finals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, eventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('ERROR: ' + (data.error ?? JSON.stringify(data)))
        return
      }
      await loadAll()
    } catch (err) {
      alert('Network error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return <div className="text-sm text-white/70 py-10 text-center">Loading...</div>
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-white/60 hover:text-white"
        >
          ← Back to events
        </button>
      </div>

      <div className="mb-6 rounded-xl p-5" style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}>
        <p className="text-[11px] tracking-[0.25em] uppercase text-white/60">Team Americano</p>
        <p className="text-2xl font-bold mt-1 text-white">{eventName}</p>
        <p className="text-xs text-white/60 mt-1">
          {teams.length} approved team{teams.length === 1 ? '' : 's'} · 3 rounds + finals · 4 courts
        </p>
      </div>

      {/* STEP 1: TEAM LIST + GENERATE */}
      {groupMatches.length === 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-3">Step 1 — Approved Teams</h2>
          {teams.length !== 8 ? (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}
            >
              <p className="text-yellow-300 font-semibold">
                ⚠ Need exactly 8 approved teams. You have {teams.length}.
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <p className="text-green-300 font-semibold">
                ✓ {teams.length} teams ready.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            {teams.map((t, i) => (
              <div
                key={t.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#1a3d2e', color: '#ff6b35' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{t.team_name}</p>
                    <p className="text-xs text-white/60 truncate">{teamPlayers(t.id) || '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerateSchedule}
            disabled={busy || teams.length !== 8}
            className="w-full py-5 rounded-xl text-lg font-extrabold text-white disabled:opacity-50 shadow-lg"
            style={{ backgroundColor: '#ff6b35' }}
          >
            {busy ? 'Generating...' : '🎲 Generate Schedule'}
          </button>
        </section>
      )}

      {/* STEP 2: SCHEDULE + STANDINGS */}
      {groupMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-3">Step 2 — Schedule</h2>

          <div className="space-y-4 mb-6">
            {[1, 2, 3].map(rNum => {
              const rMatches = groupMatches
                .filter(m => m.round_number === rNum)
                .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))
              if (rMatches.length === 0) return null
              return (
                <div
                  key={rNum}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}
                >
                  <div
                    className="px-4 py-2 flex items-center justify-between"
                    style={{ backgroundColor: '#1a3d2e' }}
                  >
                    <p className="text-sm font-bold text-white">{ROUND_LABELS[rNum - 1]}</p>
                    <span className="text-[10px] uppercase tracking-widest text-white/60">20 min</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#2d5a40' }}>
                    {rMatches.map(m => {
                      const input = scoreInputs[m.id] ?? { t1: '', t2: '' }
                      const scored = m.team1_score !== null && m.team2_score !== null
                      const slot = m.match_order ?? 0
                      return (
                        <div
                          key={m.id}
                          className="p-3"
                          style={{ borderColor: '#2d5a40' }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p
                              className="text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: '#ff6b35' }}
                            >
                              Court {slot}
                            </p>
                            {scored && (
                              <span className="text-[9px] font-bold text-green-300 uppercase tracking-widest">
                                Saved
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{teamLabel(m.team1_id)}</p>
                              <p className="text-[10px] text-white/50 truncate">{teamPlayers(m.team1_id)}</p>
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
                              className="w-11 text-center text-sm font-bold rounded py-1.5 outline-none text-white"
                              style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
                            />
                            <span className="text-white/50 text-xs">:</span>
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
                              className="w-11 text-center text-sm font-bold rounded py-1.5 outline-none text-white"
                              style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
                            />
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xs font-semibold text-white truncate">{teamLabel(m.team2_id)}</p>
                              <p className="text-[10px] text-white/50 truncate">{teamPlayers(m.team2_id)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveMatch(m.id)}
                            className="mt-2 w-full py-1.5 rounded text-[11px] font-semibold text-white"
                            style={{
                              backgroundColor: scored ? '#16a34a' : '#1a3d2e',
                              border: '1px solid #2d5a40',
                            }}
                          >
                            {busyMatchId === m.id ? 'Saving...' : scored ? '✓ Update' : 'Save Score'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* STANDINGS */}
          {showStandings && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                Standings
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2d5a40' }}>
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: '#0f2318' }}>
                    <tr className="text-white/60 text-[11px] uppercase tracking-wider">
                      <th className="py-2 px-3 text-left font-semibold">#</th>
                      <th className="py-2 px-2 text-left font-semibold">Team</th>
                      <th className="py-2 px-2 text-right font-semibold">P</th>
                      <th className="py-2 px-2 text-right font-semibold">W</th>
                      <th className="py-2 px-2 text-right font-semibold">L</th>
                      <th className="py-2 px-3 text-right font-semibold">+/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => {
                      const diff = s.diff
                      const diffColor = diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#9ca3af'
                      const diffLabel = diff > 0 ? `+${diff}` : String(diff)
                      return (
                        <tr key={s.team_id} style={{ borderTop: '1px solid #2d5a40', backgroundColor: '#0f2318' }}>
                          <td className="py-2 px-3 font-bold text-white">{i + 1}</td>
                          <td className="py-2 px-2 font-semibold text-white">
                            <div className="truncate max-w-[160px]">{teamLabel(s.team_id)}</div>
                            <div className="text-[10px] text-white/50 truncate max-w-[160px]">
                              {teamPlayers(s.team_id)}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-white/70">{s.played}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-white">{s.wins}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-white">{s.losses}</td>
                          <td
                            className="py-2 px-3 text-right tabular-nums font-bold"
                            style={{ color: diffColor }}
                          >
                            {diffLabel}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {groupStageComplete && finalMatches.length === 0 && (
            <button
              type="button"
              onClick={handleGenerateFinals}
              disabled={busy}
              className="w-full py-4 rounded-xl text-base font-bold text-white disabled:opacity-50 shadow-lg"
              style={{ backgroundColor: '#ff6b35' }}
            >
              {busy ? 'Generating...' : '🏆 Generate Finals →'}
            </button>
          )}
          {!groupStageComplete && groupMatches.length > 0 && (
            <p className="text-xs text-white/50 text-center mt-3">
              Save every match score to unlock the finals.
            </p>
          )}
        </section>
      )}

      {/* STEP 3: FINALS */}
      {finalMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-3">Step 3 — Finals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {finalMatches
              .slice()
              .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))
              .map(m => {
                const meta = FINAL_LABELS[m.match_order ?? 0] ?? { title: 'Final', emoji: '' }
                const input = scoreInputs[m.id] ?? { t1: '', t2: '' }
                const scored = m.team1_score !== null && m.team2_score !== null
                const winnerOnLeft = scored && m.team1_score! > m.team2_score!
                const winnerOnRight = scored && m.team2_score! > m.team1_score!
                const isChampion = (m.match_order ?? 0) === 1
                return (
                  <div
                    key={m.id}
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: '#0f2318',
                      border: `1px solid ${isChampion ? '#ff6b35' : scored ? '#ff6b35' : '#2d5a40'}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ff6b35' }}>
                        {meta.emoji} {meta.title}
                      </p>
                      <span className="text-[10px] uppercase tracking-widest text-white/60">30 min</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <p
                        className="flex-1 text-sm font-semibold truncate"
                        style={{
                          color: winnerOnLeft ? '#ff6b35' : winnerOnRight ? 'rgba(255,255,255,0.5)' : '#fff',
                        }}
                      >
                        {teamLabel(m.team1_id)}
                      </p>
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
                        className="w-12 text-center text-sm font-bold rounded py-1.5 outline-none text-white"
                        style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
                      />
                      <span className="text-white/50 text-xs">:</span>
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
                        className="w-12 text-center text-sm font-bold rounded py-1.5 outline-none text-white"
                        style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
                      />
                      <p
                        className="flex-1 text-sm font-semibold truncate text-right"
                        style={{
                          color: winnerOnRight ? '#ff6b35' : winnerOnLeft ? 'rgba(255,255,255,0.5)' : '#fff',
                        }}
                      >
                        {teamLabel(m.team2_id)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveMatch(m.id)}
                      className="w-full py-1.5 rounded text-[11px] font-semibold text-white"
                      style={{
                        backgroundColor: scored ? '#16a34a' : '#1a3d2e',
                        border: '1px solid #2d5a40',
                      }}
                    >
                      {busyMatchId === m.id ? 'Saving...' : scored ? '✓ Update' : 'Save'}
                    </button>
                  </div>
                )
              })}
          </div>

          {finalMatches.every(m => m.team1_score !== null && m.team2_score !== null) && (
            <FinalStandings finalMatches={finalMatches} teamLabel={teamLabel} teamPlayers={teamPlayers} />
          )}
        </section>
      )}
    </div>
  )
}

type FinalStandingsProps = {
  finalMatches: Match[]
  teamLabel: (id: string | null) => string
  teamPlayers: (id: string | null) => string
}

function FinalStandings({ finalMatches, teamLabel, teamPlayers }: FinalStandingsProps) {
  const ordered = finalMatches.slice().sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))
  const placements: Array<{ rank: number; team_id: string | null; label: string }> = []
  for (const m of ordered) {
    const order = m.match_order ?? 0
    const baseRank = (order - 1) * 2 + 1
    if (m.team1_score == null || m.team2_score == null) continue
    const winner = m.team1_score > m.team2_score ? m.team1_id : m.team2_id
    const loser = m.team1_score > m.team2_score ? m.team2_id : m.team1_id
    const winnerLabel = order === 1 ? '🏆 Champion' : `${ordinal(baseRank)}`
    const loserLabel = `${ordinal(baseRank + 1)}`
    placements.push({ rank: baseRank, team_id: winner, label: winnerLabel })
    placements.push({ rank: baseRank + 1, team_id: loser, label: loserLabel })
  }
  placements.sort((a, b) => a.rank - b.rank)

  return (
    <div>
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Final Standings</p>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2d5a40' }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: '#0f2318' }}>
            <tr className="text-white/60 text-[11px] uppercase tracking-wider">
              <th className="py-2 px-3 text-left font-semibold">Place</th>
              <th className="py-2 px-2 text-left font-semibold">Team</th>
            </tr>
          </thead>
          <tbody>
            {placements.map(p => (
              <tr
                key={p.rank}
                style={{
                  borderTop: '1px solid #2d5a40',
                  backgroundColor: p.rank === 1 ? 'rgba(255,107,53,0.08)' : '#0f2318',
                }}
              >
                <td className="py-2 px-3 font-bold" style={{ color: p.rank === 1 ? '#ff6b35' : '#fff' }}>
                  {p.label}
                </td>
                <td className="py-2 px-2 font-semibold text-white">
                  <div className="truncate">{teamLabel(p.team_id)}</div>
                  <div className="text-[10px] text-white/50 truncate">{teamPlayers(p.team_id)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
