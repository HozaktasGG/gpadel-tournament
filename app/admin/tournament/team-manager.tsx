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
  skill_score: number | null
}
type Group = {
  id: string
  team_registration_id: string
  group_name: string
  position: number | null
}
type Match = {
  id: string
  phase: 'group' | 'quarter' | 'semi' | 'final'
  group_name: string | null
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

const GROUP_NAMES = ['A', 'B', 'C', 'D'] as const

export default function TeamManager({ eventId, eventName, onBack }: Props) {
  const { password } = useAdmin()
  const supabase = createClient()

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [scoreInputs, setScoreInputs] = useState<Record<string, { t1: string; t2: string }>>({})
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyMatchId, setBusyMatchId] = useState('')

  const loadAll = useCallback(async () => {
    const [teamsRes, groupsRes, matchesRes] = await Promise.all([
      supabase
        .from('team_registrations')
        .select('id, team_name, captain_id, partner_id')
        .eq('event_id', eventId)
        .eq('status', 'approved'),
      supabase
        .from('team_tournament_groups')
        .select('id, team_registration_id, group_name, position')
        .eq('event_id', eventId),
      supabase
        .from('team_tournament_matches')
        .select('id, phase, group_name, round_number, team1_id, team2_id, team1_score, team2_score, winner_id, match_order')
        .eq('event_id', eventId)
        .order('match_order', { ascending: true }),
    ])

    const teamRows = (teamsRes.data ?? []) as Team[]
    const groupRows = (groupsRes.data ?? []) as Group[]
    const matchRows = (matchesRes.data ?? []) as Match[]

    const playerIds = teamRows
      .flatMap(t => [t.captain_id, t.partner_id])
      .filter((id): id is string => !!id)

    let playerRows: Player[] = []
    if (playerIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, skill_score')
        .in('id', playerIds)
      playerRows = (data ?? []) as Player[]
    }

    setTeams(teamRows)
    setPlayers(playerRows)
    setGroups(groupRows)
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
    const t = teamById.get(id)
    return t?.team_name ?? '—'
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

  const groupMap = new Map<string, Group[]>()
  for (const g of groups) {
    if (!groupMap.has(g.group_name)) groupMap.set(g.group_name, [])
    groupMap.get(g.group_name)!.push(g)
  }

  const groupMatches = matches.filter(m => m.phase === 'group')
  const knockoutMatches = matches.filter(m => m.phase !== 'group')
  const groupStageComplete =
    groupMatches.length > 0 &&
    groupMatches.every(m => m.team1_score !== null && m.team2_score !== null)

  const handleDrawGroups = async () => {
    if (teams.length !== 16) {
      alert(`Need exactly 16 approved teams to draw groups (you have ${teams.length}).`)
      return
    }
    if (!confirm('Draw groups? This will randomly assign 16 teams into 4 groups of 4 and create the group stage matches.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/team-tournament/draw-groups', {
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

  const handleGenerateKnockout = async () => {
    if (!confirm('Generate the knockout bracket from current group standings?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/team-tournament/generate-knockout', {
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

  const handleReset = async () => {
    if (!confirm('Reset team tournament? Groups, matches, and scores will be deleted.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/team-tournament/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, eventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('ERROR: ' + (data.error ?? JSON.stringify(data)))
        return
      }
      setScoreInputs({})
      await loadAll()
    } catch (err) {
      alert('Network error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  type Standing = {
    team_id: string
    wins: number
    setsWon: number
    setsLost: number
    setsDiff: number
  }
  const standingsForGroup = (groupName: string): Standing[] => {
    const groupTeamIds = (groupMap.get(groupName) ?? []).map(g => g.team_registration_id)
    const arr: Standing[] = groupTeamIds.map(team_id => ({
      team_id, wins: 0, setsWon: 0, setsLost: 0, setsDiff: 0,
    }))
    for (const m of groupMatches) {
      if (m.group_name !== groupName) continue
      if (m.team1_score == null || m.team2_score == null) continue
      const a = arr.find(s => s.team_id === m.team1_id)
      const b = arr.find(s => s.team_id === m.team2_id)
      if (!a || !b) continue
      a.setsWon += m.team1_score
      a.setsLost += m.team2_score
      b.setsWon += m.team2_score
      b.setsLost += m.team1_score
      if (m.team1_score > m.team2_score) a.wins++
      else if (m.team2_score > m.team1_score) b.wins++
    }
    for (const s of arr) s.setsDiff = s.setsWon - s.setsLost
    return arr.sort((x, y) => {
      if (y.wins !== x.wins) return y.wins - x.wins
      return y.setsDiff - x.setsDiff
    })
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
        {(groups.length > 0 || matches.length > 0) && (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="text-xs font-bold px-4 py-2 rounded disabled:opacity-50"
            style={{ backgroundColor: '#ef4444', color: '#fff' }}
          >
            Reset Tournament
          </button>
        )}
      </div>

      <div className="mb-6 rounded-xl p-5" style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}>
        <p className="text-[11px] tracking-[0.25em] uppercase text-white/60">Team Tournament</p>
        <p className="text-2xl font-bold mt-1 text-white">{eventName}</p>
        <p className="text-xs text-white/60 mt-1">{teams.length} approved team{teams.length === 1 ? '' : 's'}</p>
      </div>

      {/* PHASE 1: DRAW GROUPS */}
      {groups.length === 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-3">Phase 1 — Group Draw</h2>
          {teams.length !== 16 ? (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}
            >
              <p className="text-yellow-300 font-semibold">
                ⚠ Need exactly 16 approved teams. You have {teams.length}.
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <p className="text-green-300 font-semibold">
                ✓ {teams.length} teams ready for draw.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleDrawGroups}
            disabled={busy || teams.length !== 16}
            className="w-full py-5 rounded-xl text-lg font-extrabold text-white disabled:opacity-50 shadow-lg"
            style={{ backgroundColor: '#ff6b35' }}
          >
            {busy ? 'Drawing...' : '🎲 Draw Groups'}
          </button>
        </section>
      )}

      {/* PHASE 2: GROUP STAGE */}
      {groups.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-3">Phase 2 — Group Stage</h2>

          {/* Group standings */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {GROUP_NAMES.map(gName => {
              const standings = standingsForGroup(gName)
              return (
                <div
                  key={gName}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}
                >
                  <div className="px-3 py-2" style={{ backgroundColor: '#1a3d2e' }}>
                    <p className="text-xs font-bold text-white">Group {gName}</p>
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-white/50 text-[9px] uppercase tracking-wider">
                        <th className="text-left py-1 px-2">#</th>
                        <th className="text-left py-1 px-1">Team</th>
                        <th className="text-right py-1 px-1">W</th>
                        <th className="text-right py-1 px-2">+/-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => (
                        <tr key={s.team_id} style={{ borderTop: '1px solid #2d5a40' }}>
                          <td className="py-1 px-2 font-bold text-white">{i + 1}</td>
                          <td className="py-1 px-1 text-white truncate max-w-[80px]">{teamLabel(s.team_id)}</td>
                          <td className="py-1 px-1 text-right tabular-nums text-white">{s.wins}</td>
                          <td
                            className="py-1 px-2 text-right tabular-nums font-bold"
                            style={{ color: s.setsDiff > 0 ? '#4ade80' : s.setsDiff < 0 ? '#f87171' : '#9ca3af' }}
                          >
                            {s.setsDiff > 0 ? `+${s.setsDiff}` : s.setsDiff}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>

          {/* Court schedule */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Court Schedule</p>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(slot => {
                const slotMatches = groupMatches
                  .filter(m => m.round_number === slot)
                  .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))
                if (slotMatches.length === 0) return null
                return (
                  <div
                    key={slot}
                    className="rounded-xl overflow-hidden"
                    style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}
                  >
                    <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: '#1a3d2e' }}>
                      <p className="text-sm font-bold text-white">Slot {slot}</p>
                      <p className="text-[10px] uppercase tracking-widest text-white/50">
                        {slot <= 4 ? 'Groups A · B' : 'Groups C · D'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: '#2d5a40' }}>
                      {slotMatches.map(m => {
                        const input = scoreInputs[m.id] ?? { t1: '', t2: '' }
                        const scored = m.team1_score !== null && m.team2_score !== null
                        return (
                          <div
                            key={m.id}
                            className="p-3"
                            style={{ borderColor: '#2d5a40' }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#ff6b35' }}>
                                Court {m.match_order} · Group {m.group_name}
                              </p>
                              {scored && (
                                <span className="text-[9px] font-bold text-green-300 uppercase tracking-widest">Saved</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="flex-1 text-xs font-semibold text-white truncate">{teamLabel(m.team1_id)}</p>
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
                                className="w-10 text-center text-sm font-bold rounded py-1 outline-none text-white"
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
                                className="w-10 text-center text-sm font-bold rounded py-1 outline-none text-white"
                                style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
                              />
                              <p className="flex-1 text-xs font-semibold text-white truncate text-right">{teamLabel(m.team2_id)}</p>
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
          </div>

          {groupStageComplete && knockoutMatches.length === 0 && (
            <button
              type="button"
              onClick={handleGenerateKnockout}
              disabled={busy}
              className="w-full py-4 rounded-xl text-base font-bold text-white disabled:opacity-50 shadow-lg"
              style={{ backgroundColor: '#ff6b35' }}
            >
              {busy ? 'Generating...' : '🏆 Generate Knockout Bracket'}
            </button>
          )}
          {!groupStageComplete && groupMatches.length > 0 && (
            <p className="text-xs text-white/50 text-center mt-3">
              Save all group stage scores to unlock the knockout bracket.
            </p>
          )}
        </section>
      )}

      {/* PHASE 3: KNOCKOUT BRACKET */}
      {knockoutMatches.length > 0 && (
        <KnockoutBracket
          matches={knockoutMatches}
          teamLabel={teamLabel}
          teamPlayers={teamPlayers}
          scoreInputs={scoreInputs}
          setScoreInputs={setScoreInputs}
          onSave={handleSaveMatch}
          busyMatchId={busyMatchId}
        />
      )}
    </div>
  )
}

type BracketProps = {
  matches: Match[]
  teamLabel: (id: string | null) => string
  teamPlayers: (id: string | null) => string
  scoreInputs: Record<string, { t1: string; t2: string }>
  setScoreInputs: (updater: (prev: Record<string, { t1: string; t2: string }>) => Record<string, { t1: string; t2: string }>) => void
  onSave: (matchId: string) => void
  busyMatchId: string
}

function KnockoutBracket({
  matches,
  teamLabel,
  scoreInputs,
  setScoreInputs,
  onSave,
  busyMatchId,
}: BracketProps) {
  const phaseMatches = (phase: Match['phase']) =>
    matches
      .filter(m => m.phase === phase)
      .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))

  const qfs = phaseMatches('quarter')
  const sfs = phaseMatches('semi')
  const finals = phaseMatches('final')

  const renderMatch = (m: Match, label: string) => {
    const input = scoreInputs[m.id] ?? { t1: '', t2: '' }
    const scored = m.team1_score !== null && m.team2_score !== null
    const ready = m.team1_id !== null && m.team2_id !== null
    const winnerOnLeft = scored && m.team1_score! > m.team2_score!
    const winnerOnRight = scored && m.team2_score! > m.team1_score!
    return (
      <div
        className="rounded-lg p-3"
        style={{
          backgroundColor: '#0f2318',
          border: `1px solid ${scored ? '#ff6b35' : '#2d5a40'}`,
          minWidth: 200,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#ff6b35' }}>
          {label}
        </p>
        <div className="flex items-center gap-2 mb-1">
          <p
            className="flex-1 text-xs font-semibold truncate"
            style={{ color: winnerOnLeft ? '#ff6b35' : winnerOnRight ? 'rgba(255,255,255,0.5)' : '#fff' }}
          >
            {teamLabel(m.team1_id)}
          </p>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            disabled={!ready}
            value={input.t1}
            onChange={e =>
              setScoreInputs(prev => ({
                ...prev,
                [m.id]: { ...input, t1: e.target.value },
              }))
            }
            className="w-9 text-center text-xs font-bold rounded py-1 outline-none text-white disabled:opacity-40"
            style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
          />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <p
            className="flex-1 text-xs font-semibold truncate"
            style={{ color: winnerOnRight ? '#ff6b35' : winnerOnLeft ? 'rgba(255,255,255,0.5)' : '#fff' }}
          >
            {teamLabel(m.team2_id)}
          </p>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            disabled={!ready}
            value={input.t2}
            onChange={e =>
              setScoreInputs(prev => ({
                ...prev,
                [m.id]: { ...input, t2: e.target.value },
              }))
            }
            className="w-9 text-center text-xs font-bold rounded py-1 outline-none text-white disabled:opacity-40"
            style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
          />
        </div>
        <button
          type="button"
          onClick={() => onSave(m.id)}
          disabled={!ready}
          className="w-full py-1 rounded text-[10px] font-semibold text-white disabled:opacity-40"
          style={{
            backgroundColor: scored ? '#16a34a' : '#1a3d2e',
            border: '1px solid #2d5a40',
          }}
        >
          {busyMatchId === m.id ? 'Saving...' : !ready ? 'Awaiting...' : scored ? '✓ Update' : 'Save'}
        </button>
      </div>
    )
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-white mb-4">Phase 3 — Knockout Bracket</h2>
      <div className="overflow-x-auto">
        <div className="flex items-stretch gap-6 min-w-fit pb-2">
          <div className="flex flex-col justify-around gap-4">
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Quarter Finals</p>
            {qfs.map((m, i) => (
              <div key={m.id}>{renderMatch(m, `QF${i + 1}`)}</div>
            ))}
          </div>
          <div className="flex flex-col justify-around gap-4">
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Semi Finals</p>
            {sfs.map((m, i) => (
              <div key={m.id}>{renderMatch(m, `SF${i + 1}`)}</div>
            ))}
          </div>
          <div className="flex flex-col justify-around gap-4">
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Final</p>
            {finals.map(m => (
              <div key={m.id}>{renderMatch(m, '🏆 Final')}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
