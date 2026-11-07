'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { ScheduleCard } from '@/components/AmericanoSchedule'
import TeamAmericanoStandings, { STANDINGS_RULE } from '@/components/TeamAmericanoStandings'
import {
  DEFAULT_COURTS,
  FINALS_DRAW_MESSAGE,
  type RequiredMatchup,
  type TAMatch,
  byeTeamsByRound,
  computeStandings,
  finalLabel,
  finalMatchesOf,
  finalRanking,
  finalsDecision,
  groupMatchesOf,
  isScored,
  missingGroupRounds,
  ordinal,
  roundMatches,
  slotLabel,
  taStructureLabel,
  teamAmericanoFormat,
  teamAmericanoSchedule,
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
  eventFormat: string | null
  eventTime: string | null
  onBack: () => void
}
type PostResult = { error?: string; rounds?: number[]; finals?: string; finalsError?: string; needsDecision?: boolean }

const CARD = { backgroundColor: '#0f2318', border: '1px solid #2d5a40' }
const INPUT = { backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }
const ORANGE = '#ff6b35'

export default function TeamAmericanoManager({ eventId, eventName, eventFormat, eventTime, onBack }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const format = teamAmericanoFormat(eventFormat)
  const slots = teamAmericanoSchedule(format, eventTime)

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<TAMatch[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [courts, setCourts] = useState<number>(DEFAULT_COURTS)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyMatchId, setBusyMatchId] = useState('')
  const [generating, setGenerating] = useState<'rounds' | 'regen' | 'finals' | null>(null)
  // Admin-chosen seeding when a tie was decided by the random draw (null = use the draw).
  const [tieOrder, setTieOrder] = useState<string[] | null>(null)
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
  const missing = missingGroupRounds(matches, format.groupRounds)
  const existingRounds = Array.from({ length: format.groupRounds }, (_, i) => i + 1).filter(r => !missing.includes(r))
  const groupComplete = missing.length === 0 && groupMatches.every(isScored)
  const standings = computeStandings(eventId, teamIds, matches)
  const decision = finalsDecision(eventId, teamIds, matches, format.groupRounds)
  const canRegenerate = groupMatches.length > 0 && finals.length === 0 && !groupMatches.some(isScored)
  // Seeding shown in the tie card: the admin's order if it still has the same teams, else the draw.
  const drawOrder = standings.map(s => s.team_id)
  const seeding =
    decision.status === 'needs-decision' &&
    tieOrder !== null &&
    tieOrder.length === drawOrder.length &&
    tieOrder.every(id => drawOrder.includes(id))
      ? tieOrder
      : drawOrder
  const seedingIsDraw = seeding.every((id, i) => id === drawOrder[i])
  const ranking = finalRanking(teamIds, matches)
  const byes = byeTeamsByRound(teamIds, matches)
  const matchesPerRound = Math.floor(teams.length / 2)
  const notEnoughCourts = matchesPerRound > courts

  const post = async (url: string, body: object): Promise<PostResult | null> => {
    setError('')
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as PostResult
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status}).`)
        return null
      }
      if (data.rounds?.length) setNotice(`Generated ${data.rounds.map(r => `Round ${r}`).join(', ')}.`)
      return data
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : String(err)))
      return null
    }
  }

  // Draws every missing group round at once; existing rounds are left as they are.
  const generate = async (kind: 'rounds' | 'regen' | 'finals', run: () => Promise<void>) => {
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

  const handleRegenerate = async () => {
    if (inFlight.current || !confirm('Throw away the current rounds and draw new ones?')) return
    await generate('regen', async () => {
      if (await post('/api/team-americano/regenerate-rounds', { eventId, courts, required })) {
        setRequired([])
        await loadAll()
      }
    })
  }

  // `order` is sent only when the admin settles a tie that came from the random draw.
  const handleGenerateFinals = async (order?: string[]) => {
    const prompt = order ? 'Generate the finals with this order?' : 'Generate the finals from the current standings?'
    if (inFlight.current || !confirm(prompt)) return
    await generate('finals', async () => {
      if (await post('/api/team-americano/generate-finals', { eventId, courts, ...(order ? { order } : {}) })) {
        setTieOrder(null)
        setNotice('Finals generated.')
      }
      await loadAll()
    })
  }

  // Swap a team with its neighbour inside a tie block.
  const moveInTie = (pos: number, dir: -1 | 1) => {
    const next = [...seeding]
    ;[next[pos], next[pos + dir]] = [next[pos + dir], next[pos]]
    setTieOrder(next)
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
      setError(FINALS_DRAW_MESSAGE)
      return
    }
    setBusyMatchId(m.id)
    const res = await post('/api/team-americano/save-match', { matchId: m.id, team1Score: t1, team2Score: t2 })
    if (res) {
      if (res.finals === 'generated') setNotice('All group matches saved — finals generated automatically.')
      if (res.finals === 'needs-decision') setNotice('All group matches saved — teams are tied, confirm the finals order below.')
      if (res.finals === 'error') setError('Score saved, but the finals could not be generated: ' + res.finalsError)
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
      setTieOrder(null)
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

  const renderMatchCard = (m: TAMatch, title: string, slot: string) => {
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
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs font-bold uppercase tracking-wider shrink-0" style={{ color: ORANGE }}>
            {isFinal ? '🏆 ' : ''}
            {title}
          </p>
          <span className="text-[10px] uppercase tracking-wider text-white/60 tabular-nums text-right">
            {scored && !dirty ? '✓ Saved · ' : ''}
            {slot}
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
        <p className="text-sm font-semibold mt-1" style={{ color: ORANGE }}>
          {taStructureLabel(format)}
        </p>
        <p className="text-xs text-white/60 mt-1">
          {teams.length} approved team{teams.length === 1 ? '' : 's'}
          {started ? ' · format locked while rounds exist' : ''}
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
      {(missing.length > 0 || canRegenerate) && finals.length === 0 && teams.length >= 2 && (
        <section className="mb-6 rounded-xl p-4" style={CARD}>
          <h2 className="text-sm font-bold text-white">Required matchups</h2>
          <p className="text-[11px] text-white/50 mb-3">
            Optional. Each pair is placed in the chosen round, or in any of{' '}
            {(missing.length > 0 ? missing : existingRounds).map(r => `Round ${r}`).join(' / ')}.
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
                {(missing.length > 0 ? missing : existingRounds).map(r => (
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
          {missing.length > 0 && (
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
              ) : started ? (
                `Generate Remaining Rounds (${missing.join(', ')})`
              ) : (
                'Generate Rounds'
              )}
            </button>
          )}
          {canRegenerate && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={busy || generating !== null || notEnoughCourts}
              aria-busy={generating === 'regen'}
              className="mt-3 w-full h-12 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#1a3d2e', border: `1px solid ${ORANGE}` }}
            >
              {generating === 'regen' ? (
                <>
                  <Spinner /> Regenerating…
                </>
              ) : (
                '↻ Regenerate rounds'
              )}
            </button>
          )}
          <p className="text-[11px] text-white/50 mt-2 text-center">
            {!started
              ? `Draws all ${format.groupRounds} group rounds at once — no opponent repeats.`
              : 'Rounds can be regenerated until the first score is saved.'}
          </p>
        </section>
      )}

      {/* FINALS */}
      {finals.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-bold text-white mb-3">Finals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {finals.map(m =>
              renderMatchCard(m, `${finalLabel(m.match_order ?? 1)} · Court ${m.match_order ?? '?'}`, slotLabel(slots, 'finals'))
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
                Round {r} <span className="text-white/50 font-normal">of {format.groupRounds}</span>
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
              {rm.map(m => renderMatchCard(m, `Court ${m.match_order ?? '?'}`, slotLabel(slots, 'round', r)))}
            </div>
          </section>
        )
      })}

      {decision.status === 'needs-decision' && (
        <section className="mb-6 rounded-xl p-4" style={{ ...CARD, borderColor: '#eab308' }}>
          <h2 className="text-sm font-bold text-yellow-200">Tie needs a decision</h2>
          <p className="text-[11px] text-white/60 mt-1 mb-3">
            These teams are level on wins, game difference, games won and head-to-head, so the finals were not
            generated automatically. The order below is the random draw — reorder if needed, then generate the finals.
          </p>
          {decision.ties.map(t => (
            <ul key={t.start} className="mb-3 space-y-2">
              {seeding.slice(t.start, t.end + 1).map((id, k) => {
                const pos = t.start + k
                return (
                  <li
                    key={id}
                    className="flex items-center gap-1 rounded-lg pl-3 text-sm text-white"
                    style={{ backgroundColor: '#1a3d2e' }}
                  >
                    <span className="w-8 shrink-0 font-bold" style={{ color: ORANGE }}>
                      #{pos + 1}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-semibold">{teamLabel(id)}</span>
                    <button
                      type="button"
                      onClick={() => moveInTie(pos, -1)}
                      disabled={pos === t.start}
                      className="w-11 h-11 shrink-0 text-white/80 disabled:opacity-20"
                      aria-label={`Move ${teamLabel(id)} up`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveInTie(pos, 1)}
                      disabled={pos === t.end}
                      className="w-11 h-11 shrink-0 text-white/80 disabled:opacity-20"
                      aria-label={`Move ${teamLabel(id)} down`}
                    >
                      ▼
                    </button>
                  </li>
                )
              })}
            </ul>
          ))}
          <button
            type="button"
            onClick={() => handleGenerateFinals(seeding)}
            disabled={busy || generating !== null}
            aria-busy={generating === 'finals'}
            className="w-full h-14 rounded-xl text-base font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: ORANGE }}
          >
            {generating === 'finals' ? (
              <>
                <Spinner /> Generating…
              </>
            ) : seedingIsDraw ? (
              '🏆 Accept random draw & generate finals'
            ) : (
              '🏆 Confirm order & generate finals'
            )}
          </button>
        </section>
      )}

      {missing.length === 0 && finals.length === 0 && decision.status !== 'needs-decision' && (
        <button
          type="button"
          onClick={() => handleGenerateFinals()}
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
            : `Finals are generated automatically after the last group score (${groupMatches.filter(isScored).length}/${groupMatches.length})`}
        </button>
      )}

      {/* STANDINGS (group rounds only; finals scores are never added) */}
      {started && (
        <section className="mb-6">
          <h2 className="text-base font-bold text-white mb-1">
            {finals.length > 0 ? `Group Standings (after Round ${format.groupRounds})` : 'Live Standings'}
          </h2>
          <p className="text-[11px] text-white/50 mb-3">{STANDINGS_RULE}</p>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2d5a40' }}>
            <TeamAmericanoStandings standings={standings} teamName={teamLabel} rowBg="#0f2318" border="#2d5a40" />
          </div>
        </section>
      )}

      <section className="mb-6">
        <ScheduleCard slots={slots} summary={taStructureLabel(format)} />
      </section>

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
