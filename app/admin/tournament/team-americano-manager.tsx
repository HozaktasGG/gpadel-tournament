'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import {
  DEFAULT_COURTS,
  FINALS_MINUTES,
  GROUP_ROUNDS,
  GROUP_ROUND_MINUTES,
  type RequiredMatchup,
  type TAMatch,
  byeTeamsByRound,
  computeStandings,
  finalLabel,
  finalMatchesOf,
  finalRanking,
  groupMatchesOf,
  isScored,
  missingGroupRounds,
  ordinal,
  roundMatches,
  signed,
} from '@/lib/team-americano'

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
  player_code: string | null
}
type Draft = { t1: string; t2: string }

type Props = {
  eventId: string
  eventName: string
  onBack: () => void
}

const CARD = { backgroundColor: '#0f2318', border: '1px solid #2d5a40' }
const INPUT = { backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }
const ORANGE = '#ff6b35'

export default function TeamAmericanoManager({ eventId, eventName, onBack }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<TAMatch[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [courts, setCourts] = useState<number>(DEFAULT_COURTS)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyMatchId, setBusyMatchId] = useState('')
  const [generating, setGenerating] = useState<'rounds' | 'finals' | null>(null)
  // Set synchronously so a double tap can't fire a second request before React re-renders.
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [required, setRequired] = useState<RequiredMatchup[]>([])
  const [reqA, setReqA] = useState('')
  const [reqB, setReqB] = useState('')
  const [reqRound, setReqRound] = useState('')

  const loadAll = useCallback(async () => {
    const [teamsRes, matchesRes] = await Promise.all([
      supabase
        .from('team_registrations')
        .select('id, team_name, captain_id, partner_id')
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true }),
      supabase
        .from('team_tournament_matches')
        .select('id, phase, round_number, team1_id, team2_id, team1_score, team2_score, winner_id, match_order')
        .eq('event_id', eventId),
    ])
    if (teamsRes.error || matchesRes.error) {
      setError('Failed to load: ' + (teamsRes.error ?? matchesRes.error)?.message)
    }

    const teamRows = (teamsRes.data ?? []) as Team[]
    const playerIds = teamRows
      .flatMap(t => [t.captain_id, t.partner_id])
      .filter((id): id is string => !!id)

    let playerRows: Player[] = []
    if (playerIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, player_code')
        .in('id', playerIds)
      playerRows = (data ?? []) as Player[]
    }

    setTeams(teamRows)
    setPlayers(playerRows)
    setMatches((matchesRes.data ?? []) as TAMatch[])
    setLoaded(true)
  }, [eventId, supabase])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Keep several admin phones in sync.
  useEffect(() => {
    const channel = supabase
      .channel(`ta-admin-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_tournament_matches', filter: `event_id=eq.${eventId}` },
        () => loadAll()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, loadAll, supabase])

  const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])
  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const teamIds = useMemo(() => teams.map(t => t.id), [teams])

  const teamLabel = (id: string | null): string => (id ? teamById.get(id)?.team_name ?? '—' : '—')
  const playerName = (id: string | null): string => {
    const p = id ? playerById.get(id) : undefined
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim() : ''
  }
  const teamPlayers = (id: string | null): string => {
    const t = id ? teamById.get(id) : undefined
    if (!t) return ''
    return [playerName(t.captain_id), playerName(t.partner_id)].filter(Boolean).join(' & ')
  }

  const finals = finalMatchesOf(matches)
  const groupMatches = groupMatchesOf(matches)
  const missing = missingGroupRounds(matches)
  const existingRounds = Array.from({ length: GROUP_ROUNDS }, (_, i) => i + 1).filter(r => !missing.includes(r))
  const groupComplete = missing.length === 0 && groupMatches.every(isScored)
  const standings = computeStandings(eventId, teamIds, matches)
  const ranking = finalRanking(teamIds, matches)
  const byes = byeTeamsByRound(teamIds, matches)
  const matchesPerRound = Math.floor(teams.length / 2)
  const notEnoughCourts = matchesPerRound > courts

  const post = async (url: string, body: object): Promise<boolean> => {
    setError('')
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string; rounds?: number[] }
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status}).`)
        return false
      }
      if (data.rounds?.length) setNotice(`Generated ${data.rounds.map(r => `Round ${r}`).join(', ')}.`)
      return true
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : String(err)))
      return false
    }
  }

  // Draws every missing group round at once; existing rounds are left as they are.
  const generate = async (kind: 'rounds' | 'finals', run: () => Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    setGenerating(kind)
    setBusy(true)
    setNotice('')
    try {
      await run()
    } finally {
      inFlight.current = false
      setGenerating(null)
      setBusy(false)
    }
  }

  // Draws every missing group round at once; existing rounds are left as they are.
  // `rounds` lets the server reject the request if any of them was created meanwhile.
  const handleGenerateRounds = () =>
    generate('rounds', async () => {
      if (await post('/api/team-americano/generate-rounds', { eventId, courts, required, rounds: missing })) {
        setRequired([])
        await loadAll()
      }
    })

  const addRequired = () => {
    setError('')
    if (!reqA || !reqB) return setError('Pick both teams for the required matchup.')
    if (reqA === reqB) return setError('Pick two different teams.')
    const key = [reqA, reqB].sort().join('|')
    if (required.some(q => [q.team1_id, q.team2_id].sort().join('|') === key)) {
      return setError('That matchup is already in the list.')
    }
    setRequired([...required, { team1_id: reqA, team2_id: reqB, round: reqRound ? Number(reqRound) : null }])
    setReqA('')
    setReqB('')
    setReqRound('')
  }

  const handleGenerateFinals = async () => {
    if (inFlight.current || !confirm('Generate the finals from the current standings?')) return
    await generate('finals', async () => {
      if (await post('/api/team-americano/generate-finals', { eventId, courts })) await loadAll()
    })
  }

  const handleSave = async (m: TAMatch) => {
    const d = drafts[m.id] ?? draftFrom(m)
    if (d.t1 === '' || d.t2 === '') {
      setError('Enter games for both teams.')
      return
    }
    const t1 = Number(d.t1)
    const t2 = Number(d.t2)
    if (!Number.isInteger(t1) || !Number.isInteger(t2) || t1 < 0 || t2 < 0) {
      setError('Games must be whole numbers (0 or more).')
      return
    }
    if (m.phase === 'final' && t1 === t2) {
      setError('Finals need a winner — draws are not allowed.')
      return
    }
    setBusyMatchId(m.id)
    if (await post('/api/team-americano/save-match', { matchId: m.id, team1Score: t1, team2Score: t2 })) {
      setDrafts(prev => {
        const next = { ...prev }
        delete next[m.id]
        return next
      })
      await loadAll()
    }
    setBusyMatchId('')
  }

  const handleReset = async () => {
    if (!confirm(`Reset "${eventName}"? This deletes every round, score and final for this event.`)) return
    setBusy(true)
    setNotice('')
    if (await post('/api/team-tournament/reset', { eventId })) {
      setDrafts({})
      await loadAll()
    }
    setBusy(false)
  }

  const setDraft = (m: TAMatch, side: 't1' | 't2', value: string) =>
    setDrafts(prev => ({ ...prev, [m.id]: { ...(prev[m.id] ?? draftFrom(m)), [side]: value } }))

  if (!loaded) {
    return <div className="text-sm text-white/70 py-10 text-center">Loading...</div>
  }

  const started = matches.length > 0

  const teamSelect = (label: string, value: string, set: (v: string) => void, other: string) => (
    <select
      aria-label={label}
      value={value}
      onChange={e => set(e.target.value)}
      className="w-full h-11 px-3 rounded-lg text-sm text-white outline-none"
      style={INPUT}
    >
      <option value="">{label}…</option>
      {teams
        .filter(t => t.id !== other)
        .map(t => (
          <option key={t.id} value={t.id}>
            {t.team_name}
          </option>
        ))}
    </select>
  )

  const renderMatchCard = (m: TAMatch, title: string, minutes: number) => {
    const draft = drafts[m.id] ?? draftFrom(m)
    const scored = isScored(m)
    const dirty = drafts[m.id] !== undefined
    const t1Won = scored && (m.team1_score ?? 0) > (m.team2_score ?? 0)
    const t2Won = scored && (m.team2_score ?? 0) > (m.team1_score ?? 0)
    const isFinal = m.phase === 'final' && m.match_order === 1
    return (
      <div
        key={m.id}
        className="rounded-xl p-4"
        style={{ ...CARD, borderColor: isFinal ? ORANGE : scored && !dirty ? '#16a34a' : '#2d5a40' }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ORANGE }}>
            {isFinal ? '🏆 ' : ''}
            {title}
          </p>
          <span className="text-[10px] uppercase tracking-widest text-white/60">
            {scored && !dirty ? '✓ Saved · ' : ''}
            {minutes} min
          </span>
        </div>
        <div className="space-y-2">
          {([
            ['t1', m.team1_id, t1Won, t2Won],
            ['t2', m.team2_id, t2Won, t1Won],
          ] as const).map(([side, teamId, won, lost]) => (
            <div key={side} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: won ? ORANGE : lost ? 'rgba(255,255,255,0.55)' : '#fff' }}
                >
                  {teamLabel(teamId)}
                </p>
                <p className="text-[11px] text-white/50 truncate">{teamPlayers(teamId)}</p>
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                aria-label={`Games for ${teamLabel(teamId)}`}
                value={draft[side]}
                onChange={e => setDraft(m, side, e.target.value)}
                className="w-16 h-11 text-center text-lg font-bold rounded-lg outline-none text-white"
                style={INPUT}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handleSave(m)}
          disabled={busyMatchId === m.id}
          className="mt-3 w-full h-11 rounded-lg text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: scored && !dirty ? '#16a34a' : ORANGE }}
        >
          {busyMatchId === m.id ? 'Saving...' : scored && !dirty ? '✓ Saved — tap to update' : 'Save'}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-center justify-between mb-4 gap-3">
        <button type="button" onClick={onBack} className="h-11 text-sm text-white/70 hover:text-white">
          ← Back to events
        </button>
        {started && (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="h-11 px-4 text-xs font-bold rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#ef4444', color: '#fff' }}
          >
            Reset Tournament
          </button>
        )}
      </div>

      <div className="mb-5 rounded-xl p-4" style={CARD}>
        <p className="text-[11px] tracking-[0.25em] uppercase text-white/60">Team Americano</p>
        <p className="text-xl font-bold mt-1 text-white">{eventName}</p>
        <p className="text-xs text-white/60 mt-1">
          {teams.length} approved team{teams.length === 1 ? '' : 's'} · {GROUP_ROUNDS} rounds × {GROUP_ROUND_MINUTES}{' '}
          min + finals {FINALS_MINUTES} min
        </p>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-white/80">Courts</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={courts}
            onChange={e => setCourts(Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 1))))}
            className="w-20 h-11 text-center text-base font-bold rounded-lg outline-none text-white"
            style={INPUT}
          />
        </label>
        {notEnoughCourts && (
          <p className="text-xs text-yellow-300 mt-2">
            {teams.length} teams need {matchesPerRound} courts at once — increase the court count.
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl px-4 py-3 text-sm text-red-200 flex items-start justify-between gap-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)' }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-200/80 px-2" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm text-yellow-200"
          style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}
        >
          {notice}
        </div>
      )}

      {/* TEAMS */}
      <details open={!started} className="mb-6 rounded-xl" style={CARD}>
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-white min-h-[44px] flex items-center">
          Teams ({teams.length})
        </summary>
        <ul className="px-4 pb-3 divide-y" style={{ borderColor: '#2d5a40' }}>
          {teams.map((t, i) => (
            <li key={t.id} className="py-2 flex items-center gap-3" style={{ borderColor: '#2d5a40' }}>
              <span
                className="text-xs font-bold w-7 h-7 shrink-0 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#1a3d2e', color: ORANGE }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{t.team_name}</p>
                {[t.captain_id, t.partner_id].map((pid, k) => {
                  const code = pid ? playerById.get(pid)?.player_code : null
                  return (
                    <p key={k} className="text-xs text-white/60 truncate">
                      {playerName(pid) || '—'}
                      {code ? <span className="text-white/40"> · {code}</span> : null}
                    </p>
                  )
                })}
              </div>
            </li>
          ))}
          {teams.length === 0 && <li className="py-2 text-sm text-white/60">No approved teams yet.</li>}
        </ul>
      </details>

      {/* GENERATE GROUP ROUNDS (all at once; existing rounds are kept) */}
      {missing.length > 0 && finals.length === 0 && teams.length >= 2 && (
        <section className="mb-6 rounded-xl p-4" style={CARD}>
          <h2 className="text-sm font-bold text-white">Required matchups</h2>
          <p className="text-[11px] text-white/50 mb-3">
            Optional. Each pair is placed in the chosen round, or in any of {missing.map(r => `Round ${r}`).join(' / ')}.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {teamSelect('Team A', reqA, setReqA, reqB)}
            {teamSelect('Team B', reqB, setReqB, reqA)}
            <div className="flex gap-2">
              <select
                aria-label="Round"
                value={reqRound}
                onChange={e => setReqRound(e.target.value)}
                className="flex-1 h-11 px-3 rounded-lg text-sm text-white outline-none"
                style={INPUT}
              >
                <option value="">Any remaining round</option>
                {missing.map(r => (
                  <option key={r} value={r}>
                    Round {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addRequired}
                className="h-11 px-4 rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: '#1a3d2e', border: `1px solid ${ORANGE}` }}
              >
                + Add
              </button>
            </div>
          </div>
          {required.length > 0 && (
            <ul className="mt-3 space-y-2">
              {required.map((q, i) => (
                <li
                  key={`${q.team1_id}-${q.team2_id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white"
                  style={{ backgroundColor: '#1a3d2e' }}
                >
                  <span className="flex-1 min-w-0">
                    {teamLabel(q.team1_id)} <span className="text-white/50">vs</span> {teamLabel(q.team2_id)}
                    <span className="block text-[11px] text-white/50">{q.round ? `Round ${q.round}` : 'Any remaining round'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRequired(required.filter((_, k) => k !== i))}
                    className="w-11 h-11 shrink-0 text-white/70"
                    aria-label="Remove required matchup"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={handleGenerateRounds}
            disabled={busy || generating !== null || notEnoughCourts}
            aria-busy={generating === 'rounds'}
            className="mt-4 w-full h-14 rounded-xl text-lg font-extrabold text-white disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: ORANGE }}
          >
            {generating === 'rounds' ? (
              <>
                <Spinner /> Generating…
              </>
            ) : started
              ? `Generate Remaining Rounds (${missing.join(', ')})`
              : 'Start Tournament'}
          </button>
          {!started && (
            <p className="text-[11px] text-white/50 mt-2 text-center">Draws all {GROUP_ROUNDS} group rounds at once.</p>
          )}
        </section>
      )}

      {/* FINALS */}
      {finals.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-bold text-white mb-3">Finals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {finals.map(m =>
              renderMatchCard(m, `${finalLabel(m.match_order ?? 1)} · Court ${m.match_order ?? '?'}`, FINALS_MINUTES)
            )}
          </div>
        </section>
      )}

      {ranking && (
        <section className="mb-6">
          <h2 className="text-base font-bold text-white mb-3">Final Ranking</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2d5a40' }}>
            <table className="w-full text-sm">
              <tbody>
                {ranking.map(p => (
                  <tr
                    key={p.team_id}
                    style={{
                      borderTop: '1px solid #2d5a40',
                      backgroundColor: p.rank === 1 ? 'rgba(255,107,53,0.12)' : '#0f2318',
                    }}
                  >
                    <td className="py-3 px-3 font-bold w-16" style={{ color: p.rank === 1 ? ORANGE : '#fff' }}>
                      {p.rank === 1 ? '🏆' : ordinal(p.rank)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-semibold text-white truncate">{teamLabel(p.team_id)}</div>
                      <div className="text-[11px] text-white/50 truncate">{teamPlayers(p.team_id)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* GROUP ROUNDS — all stacked; scores can be entered in any order */}
      {existingRounds.map(r => {
        const rm = roundMatches(matches, r)
        return (
          <section key={r} className="mb-6">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-bold text-white">
                Round {r} <span className="text-white/50 font-normal">of {GROUP_ROUNDS}</span>
              </h2>
              <span className="text-xs text-white/60">
                {rm.filter(isScored).length}/{rm.length} saved
              </span>
            </div>
            {(byes.get(r) ?? []).map(id => (
              <p key={id} className="text-xs text-yellow-200 mb-2">
                Bye: {teamLabel(id)}
              </p>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rm.map(m => renderMatchCard(m, `Court ${m.match_order ?? '?'}`, GROUP_ROUND_MINUTES))}
            </div>
          </section>
        )
      })}

      {missing.length === 0 && finals.length === 0 && (
        <button
          type="button"
          onClick={handleGenerateFinals}
          disabled={busy || generating !== null || !groupComplete}
          aria-busy={generating === 'finals'}
          className="mb-6 w-full h-14 rounded-xl text-base font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: ORANGE }}
        >
          {generating === 'finals' ? (
            <>
              <Spinner /> Generating…
            </>
          ) : groupComplete
            ? '🏆 Generate Finals'
            : `Save every group match to unlock finals (${groupMatches.filter(isScored).length}/${groupMatches.length})`}
        </button>
      )}

      {/* STANDINGS (rounds 1–3 only; finals scores are not added) */}
      {started && (
        <section className="mb-6">
          <h2 className="text-base font-bold text-white mb-1">
            {finals.length > 0 ? 'Group Standings (after Round 3)' : 'Live Standings'}
          </h2>
          <p className="text-[11px] text-white/50 mb-3">Game difference → games won → head-to-head → random</p>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2d5a40' }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#0f2318' }}>
                <tr className="text-white/60 text-[11px] uppercase tracking-wider">
                  <th className="py-2 px-3 text-left font-semibold">#</th>
                  <th className="py-2 px-2 text-left font-semibold">Team</th>
                  <th className="py-2 px-2 text-right font-semibold">Played</th>
                  <th className="py-2 px-2 text-right font-semibold">Games Won</th>
                  <th className="py-2 px-3 text-right font-semibold">+/-</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.team_id} style={{ borderTop: '1px solid #2d5a40', backgroundColor: '#0f2318' }}>
                    <td className="py-2 px-3 font-bold text-white">{i + 1}</td>
                    <td className="py-2 px-2 font-semibold text-white">
                      <div className="truncate max-w-[140px] sm:max-w-none">{teamLabel(s.team_id)}</div>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-white/70">{s.played}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-white">{s.gamesWon}</td>
                    <td
                      className="py-2 px-3 text-right tabular-nums font-bold"
                      style={{ color: s.diff > 0 ? '#4ade80' : s.diff < 0 ? '#f87171' : '#9ca3af' }}
                    >
                      {signed(s.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin"
    />
  )
}

function draftFrom(m: TAMatch): Draft {
  return {
    t1: m.team1_score !== null ? String(m.team1_score) : '',
    t2: m.team2_score !== null ? String(m.team2_score) : '',
  }
}
