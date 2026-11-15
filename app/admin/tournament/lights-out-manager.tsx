'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { ScheduleCard } from '@/components/AmericanoSchedule'
import { LightsOutDraw, LightsOutRules, LightsOutStandings } from '@/components/LightsOutView'
import {
  type CourtPoints,
  type CourtResult,
  type LOMatch,
  type LOTeamView,
  type LOTournament,
  DEFAULT_LO_COURTS,
  LO_MATCH_COLUMNS,
  LO_TOURNAMENT_COLUMNS,
  MIN_COURTS,
  defaultPointsTable,
  drawIsCurrent,
  drawMatchesOf,
  finalMatchesOf,
  finalStandings,
  lightsOutFormat,
  lightsOutSchedule,
  loStructureLabel,
  ordinal,
  requiredTeams,
  sameStandings,
  validateFinalFixture,
} from '@/lib/lights-out'

type Team = { id: string; team_name: string; captain_id: string | null; partner_id: string | null }
type Player = { id: string; first_name: string | null; last_name: string | null; player_code: string | null }
type FinalDraft = { t1: string; t2: string; winner: string }
type PointsDraft = { winner: string; loser: string }

type Props = {
  eventId: string
  eventName: string
  eventFormat: string | null
  eventTime: string | null
  maxPlayers: number | null
  onBack: () => void
}

const CARD = { backgroundColor: '#0f2318', border: '1px solid #2d5a40' }
const INPUT = { backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }
const ORANGE = '#ff6b35'

const toInt = (s: string): number | null => (/^-?\d+$/.test(s.trim()) ? Number(s.trim()) : null)

export default function LightsOutManager({ eventId, eventName, eventFormat, eventTime, maxPlayers, onBack }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const format = lightsOutFormat(eventFormat)

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<LOMatch[]>([])
  const [tournament, setTournament] = useState<LOTournament | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Court count typed by the admin; null = follow the saved value (or the default).
  const [courtsInput, setCourtsInput] = useState<number | null>(null)
  // Unsaved edits; null = show what is saved.
  const [finalDraft, setFinalDraft] = useState<Record<number, FinalDraft> | null>(null)
  const [pointsDraft, setPointsDraft] = useState<Record<number, PointsDraft> | null>(null)
  const [busy, setBusy] = useState('')
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadAll = useCallback(async () => {
    const [teamsRes, matchesRes, tournamentRes] = await Promise.all([
      supabase
        .from('team_registrations')
        .select('id, team_name, captain_id, partner_id')
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true }),
      supabase.from('team_tournament_matches').select(LO_MATCH_COLUMNS).eq('event_id', eventId),
      supabase.from('lights_out_tournaments').select(LO_TOURNAMENT_COLUMNS).eq('event_id', eventId).maybeSingle<LOTournament>(),
    ])
    const failed = teamsRes.error ?? matchesRes.error ?? tournamentRes.error
    if (failed) setError('Failed to load: ' + failed.message)

    const teamRows = (teamsRes.data ?? []) as Team[]
    const playerIds = teamRows.flatMap(t => [t.captain_id, t.partner_id]).filter((id): id is string => !!id)
    let playerRows: Player[] = []
    if (playerIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, player_code').in('id', playerIds)
      playerRows = (data ?? []) as Player[]
    }

    setTeams(teamRows)
    setPlayers(playerRows)
    setMatches((matchesRes.data ?? []) as LOMatch[])
    setTournament(tournamentRes.data ?? null)
    setLoaded(true)
  }, [eventId, supabase])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Keep several admin phones in sync.
  useEffect(() => {
    const channel = supabase
      .channel(`lo-admin-${eventId}`)
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

  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const teamIds = useMemo(() => teams.map(t => t.id), [teams])
  const playerName = useCallback(
    (id: string | null): string => {
      const p = id ? playerById.get(id) : undefined
      return p ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim() : ''
    },
    [playerById]
  )
  const teamViews = useMemo(
    () =>
      new Map<string, LOTeamView>(
        teams.map(t => [
          t.id,
          { id: t.id, team_name: t.team_name, players: [playerName(t.captain_id), playerName(t.partner_id)].filter(Boolean) },
        ])
      ),
    [teams, playerName]
  )
  const teamLabel = (id: string | null): string => (id ? teamViews.get(id)?.team_name ?? '—' : '—')

  const draw = drawMatchesOf(matches)
  const finals = finalMatchesOf(matches)
  const started = !!tournament?.started_at
  const defaultCourts = tournament?.courts ?? (maxPlayers ? Math.max(MIN_COURTS, Math.round(maxPlayers / 4)) : DEFAULT_LO_COURTS)
  // Once started, the court count is fixed to what was drawn.
  const courts = started && tournament ? tournament.courts : courtsInput ?? defaultCourts
  const need = requiredTeams(courts)
  const countOk = teams.length === need
  const drawCurrent = draw.length === courts && drawIsCurrent(draw, teamIds)
  const courtNumbers = Array.from({ length: courts }, (_, i) => i + 1)

  // ── Final fixture (saved rows, overlaid with unsaved edits) ──
  const savedFinal = (court: number): FinalDraft => {
    const m = finals.find(f => f.match_order === court)
    return { t1: m?.team1_id ?? '', t2: m?.team2_id ?? '', winner: m?.winner_id ?? '' }
  }
  const finalRow = (court: number): FinalDraft => finalDraft?.[court] ?? savedFinal(court)
  const finalDirty =
    finalDraft !== null &&
    courtNumbers.some(c => {
      const a = finalRow(c)
      const b = savedFinal(c)
      return a.t1 !== b.t1 || a.t2 !== b.t2 || a.winner !== b.winner
    })
  const setFinal = (court: number, patch: Partial<FinalDraft>) => {
    const next = { ...finalRow(court), ...patch }
    if (next.winner && next.winner !== next.t1 && next.winner !== next.t2) next.winner = ''
    setFinalDraft(prev => ({ ...(prev ?? {}), [court]: next }))
    setError('')
  }
  const usedElsewhere = (court: number): Set<string> =>
    new Set(courtNumbers.filter(c => c !== court).flatMap(c => [finalRow(c).t1, finalRow(c).t2]).filter(Boolean))
  const winnersPicked = courtNumbers.filter(c => finalRow(c).winner).length

  // ── Points table (editable until confirmed; pre-filled with what was applied) ──
  const basePoints: CourtPoints[] =
    tournament?.points_table && tournament.points_table.length === courts ? tournament.points_table : defaultPointsTable(courts)
  const pointsRow = (court: number): PointsDraft => {
    const base = basePoints.find(p => p.court === court)
    return pointsDraft?.[court] ?? { winner: String(base?.winner ?? 0), loser: String(base?.loser ?? 0) }
  }
  const setPoints = (court: number, patch: Partial<PointsDraft>) =>
    setPointsDraft(prev => ({ ...(prev ?? {}), [court]: { ...pointsRow(court), ...patch } }))
  const pointsTable: CourtPoints[] | null = (() => {
    const out: CourtPoints[] = []
    for (const c of courtNumbers) {
      const w = toInt(pointsRow(c).winner)
      const l = toInt(pointsRow(c).loser)
      if (w === null || l === null) return null
      out.push({ court: c, winner: w, loser: l })
    }
    return out
  })()

  // Preview is always computed from the SAVED final, so it matches what will be applied.
  const preview = pointsTable ? finalStandings(finals, pointsTable) : null
  const applied = tournament?.points_applied_at ? tournament.applied_standings : null
  const appliedInSync = sameStandings(preview, applied)

  const post = async (label: string, url: string, body: object, success?: string): Promise<boolean> => {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(label)
    setError('')
    setNotice('')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status}).`)
        return false
      }
      await loadAll()
      if (success) setNotice(success)
      return true
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : String(err)))
      return false
    } finally {
      inFlight.current = false
      setBusy('')
    }
  }

  const handleDraw = async () => {
    if (draw.length > 0 && !confirm('Throw away the current draw and draw the courts again?')) return
    if (await post('draw', '/api/lights-out/draw', { eventId, courts }, 'Courts drawn.')) setCourtsInput(null)
  }

  const handleStart = async (value: boolean) => {
    const question = value
      ? 'Start the event? The draw is locked and can no longer be re-drawn.'
      : 'Unlock the draw? You can re-draw again afterwards.'
    if (!confirm(question)) return
    await post('start', '/api/lights-out/start', { eventId, started: value }, value ? 'Event started — draw locked.' : 'Draw unlocked.')
  }

  const handleSaveFinal = async () => {
    const fixture: CourtResult[] = courtNumbers.map(c => {
      const r = finalRow(c)
      return { court: c, team1_id: r.t1, team2_id: r.t2, winner_id: r.winner || null }
    })
    const invalid = validateFinalFixture(fixture, teamIds, courts, id => teamLabel(id))
    if (invalid) {
      setNotice('')
      setError(invalid)
      return
    }
    const done = fixture.every(f => f.winner_id)
    if (await post('final', '/api/lights-out/save-final', { eventId, fixture }, done ? 'Final results saved.' : 'Final fixture saved.')) {
      setFinalDraft(null)
    }
  }

  const handleApply = async () => {
    if (!pointsTable || !preview) return
    const question = applied
      ? 'Re-apply the points? The points applied earlier for this tournament are rolled back and replaced.'
      : 'Apply these points to the leaderboard?'
    if (!confirm(question)) return
    if (await post('apply', '/api/lights-out/apply-points', { eventId, pointsTable }, 'Points applied to the leaderboard.')) {
      setPointsDraft(null)
    }
  }

  const handleReset = async () => {
    const extra = applied ? ' The applied leaderboard points are rolled back.' : ''
    if (!confirm(`Reset "${eventName}"? This deletes the draw and the final for this event.${extra}`)) return
    if (await post('reset', '/api/lights-out/reset', { eventId }, 'Tournament reset.')) {
      setFinalDraft(null)
      setPointsDraft(null)
      setCourtsInput(null)
    }
  }

  if (!loaded) return <div className="text-sm text-white/70 py-10 text-center">Loading...</div>

  const anyBusy = busy !== ''
  const bigButton = 'w-full h-14 rounded-xl text-base font-extrabold text-white disabled:opacity-40 flex items-center justify-center gap-2'
  const ghostButton = 'w-full h-12 rounded-xl text-sm font-bold text-white disabled:opacity-40'
  const selectCls = 'w-full h-12 px-3 rounded-lg text-base text-white outline-none'

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-center justify-between mb-4 gap-3">
        <button type="button" onClick={onBack} className="h-11 text-sm text-white/70 hover:text-white">
          ← Back to events
        </button>
        {tournament && (
          <button
            type="button"
            onClick={handleReset}
            disabled={anyBusy}
            className="h-11 px-4 text-xs font-bold rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#ef4444', color: '#fff' }}
          >
            {busy === 'reset' ? 'Resetting…' : 'Reset Tournament'}
          </button>
        )}
      </div>

      {/* SETUP */}
      <div className="mb-5 rounded-xl p-4" style={CARD}>
        <p className="text-[11px] tracking-[0.25em] uppercase text-white/60">Lights Out</p>
        <p className="text-xl font-bold mt-1 text-white break-words">{eventName}</p>
        <p className="text-sm font-semibold mt-1" style={{ color: ORANGE }}>
          {format.name} · {loStructureLabel(format)}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-white/80">Courts</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="One court fewer"
              disabled={started || courts <= MIN_COURTS}
              onClick={() => setCourtsInput(Math.max(MIN_COURTS, courts - 1))}
              className="w-12 h-12 rounded-lg text-2xl font-bold text-white disabled:opacity-30"
              style={INPUT}
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_COURTS}
              aria-label="Number of courts"
              value={courts}
              disabled={started}
              onChange={e => setCourtsInput(Math.max(MIN_COURTS, Math.floor(Number(e.target.value) || MIN_COURTS)))}
              className="w-16 h-12 text-center text-lg font-bold rounded-lg outline-none text-white disabled:opacity-60"
              style={INPUT}
            />
            <button
              type="button"
              aria-label="One court more"
              disabled={started}
              onClick={() => setCourtsInput(courts + 1)}
              className="w-12 h-12 rounded-lg text-2xl font-bold text-white disabled:opacity-30"
              style={INPUT}
            >
              +
            </button>
          </div>
        </div>

        <div
          className="mt-3 rounded-lg px-3 py-2.5 text-sm"
          style={{
            backgroundColor: countOk ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
            color: countOk ? '#86efac' : '#fde047',
          }}
        >
          <p className="font-bold">
            {courts} courts × 2 = {need} teams required
          </p>
          <p className="text-[13px] mt-0.5">
            {countOk
              ? `✓ ${teams.length} approved teams — ready.`
              : `${teams.length} approved team${teams.length === 1 ? '' : 's'} — ${
                  teams.length > need ? `${teams.length - need} too many` : `${need - teams.length} missing`
                }. Change the court count or the approved teams.`}
          </p>
        </div>
        {started && <p className="text-xs text-white/60 mt-2">🔒 Event started — court count and draw are locked.</p>}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl px-4 py-3 text-sm text-red-200 flex items-start justify-between gap-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)' }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="w-11 h-11 -my-2 -mr-2 shrink-0 text-red-200/80" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm text-green-200"
          style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          {notice}
        </div>
      )}

      {/* TEAMS */}
      <details open={draw.length === 0} className="mb-6 rounded-xl" style={CARD}>
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-white min-h-[44px] flex items-center">
          Teams ({teams.length})
        </summary>
        <ul className="px-4 pb-3">
          {teams.map((t, i) => (
            <li key={t.id} className="py-2 flex items-center gap-3 border-t" style={{ borderColor: '#2d5a40' }}>
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

      {/* DRAW */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-bold text-white">Initial court draw</h2>
          {draw.length > 0 && (
            <a href={`/tournaments/${eventId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline" style={{ color: ORANGE }}>
              Public page ↗
            </a>
          )}
        </div>

        {draw.length > 0 && !drawCurrent && !started && (
          <p className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#facc15' }}>
            ⚠ This draw was made for {draw.length} courts / a different set of teams. Re-draw before starting.
          </p>
        )}

        {draw.length > 0 && (
          <div className="mb-4">
            <LightsOutDraw
              draw={draw.map(m => ({ court: m.match_order ?? 0, team1_id: m.team1_id ?? '', team2_id: m.team2_id ?? '' }))}
              teams={teamViews}
            />
          </div>
        )}

        {!started && (
          <>
            <button
              type="button"
              onClick={handleDraw}
              disabled={anyBusy || !countOk}
              className={draw.length > 0 ? ghostButton : bigButton}
              style={draw.length > 0 ? { backgroundColor: '#1a3d2e', border: `1px solid ${ORANGE}` } : { backgroundColor: ORANGE }}
            >
              {busy === 'draw' ? 'Drawing…' : draw.length > 0 ? '↻ Re-draw' : '🎲 Draw courts'}
            </button>
            {!countOk && (
              <p className="text-[11px] text-white/50 mt-2 text-center">
                The draw needs exactly {need} approved teams for {courts} courts.
              </p>
            )}
            {draw.length > 0 && (
              <button
                type="button"
                onClick={() => handleStart(true)}
                disabled={anyBusy || !drawCurrent}
                className={`${bigButton} mt-3`}
                style={{ backgroundColor: ORANGE }}
              >
                {busy === 'start' ? 'Starting…' : '▶ Start event & lock draw'}
              </button>
            )}
          </>
        )}
        {started && finals.length === 0 && (
          <button
            type="button"
            onClick={() => handleStart(false)}
            disabled={anyBusy}
            className={ghostButton}
            style={{ backgroundColor: '#1a3d2e', border: '1px solid #2d5a40' }}
          >
            {busy === 'start' ? 'Unlocking…' : '🔓 Unlock draw'}
          </button>
        )}
      </section>

      <section className="mb-6 space-y-3">
        <LightsOutRules format={format} courts={courts} />
        <ScheduleCard slots={lightsOutSchedule(format, eventTime)} summary={loStructureLabel(format)} />
      </section>

      {/* FINAL */}
      {started && (
        <section className="mb-6">
          <h2 className="text-base font-bold text-white">Final</h2>
          <p className="text-[12px] text-white/55 mt-1 mb-3">
            Rounds are played offline. After the last round, select the two teams on each court, then tap the winner of each
            court. No game scores are needed.
          </p>
          <div className="space-y-3">
            {courtNumbers.map(c => {
              const row = finalRow(c)
              const used = usedElsewhere(c)
              const select = (side: 't1' | 't2', other: string) => (
                <select
                  aria-label={`Court ${c} team ${side === 't1' ? 'A' : 'B'}`}
                  value={row[side]}
                  onChange={e => setFinal(c, { [side]: e.target.value })}
                  className={selectCls}
                  style={INPUT}
                >
                  <option value="">Select team…</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id} disabled={t.id === other || used.has(t.id)}>
                      {t.team_name}
                      {used.has(t.id) ? ' (on another court)' : ''}
                    </option>
                  ))}
                </select>
              )
              return (
                <div key={c} className="rounded-xl p-4" style={{ ...CARD, borderColor: row.winner ? '#16a34a' : '#2d5a40' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold" style={{ color: ORANGE }}>
                      Court {c}
                    </p>
                    <span className="text-[10px] uppercase tracking-widest text-white/50">
                      {c === 1 ? 'Top court · 1st / 2nd place' : `${ordinal(c * 2 - 1)} / ${ordinal(c * 2)} place`}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {select('t1', row.t2)}
                    {select('t2', row.t1)}
                  </div>
                  {row.t1 && row.t2 && (
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-widest text-white/50 mb-2">Winner</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[row.t1, row.t2].map(id => {
                          const on = row.winner === id
                          return (
                            <button
                              key={id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setFinal(c, { winner: on ? '' : id })}
                              className="min-h-[52px] px-2 py-2 rounded-lg text-sm font-bold text-white break-words"
                              style={on ? { backgroundColor: '#16a34a', border: '1px solid #16a34a' } : INPUT}
                            >
                              {on ? '🏆 ' : ''}
                              {teamLabel(id)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={handleSaveFinal}
            disabled={anyBusy || (!finalDirty && finals.length > 0)}
            className={`${bigButton} mt-4`}
            style={{ backgroundColor: finalDirty || finals.length === 0 ? ORANGE : '#16a34a' }}
          >
            {busy === 'final'
              ? 'Saving…'
              : !finalDirty && finals.length > 0
              ? `✓ Final saved (${winnersPicked}/${courts} winners)`
              : winnersPicked === courts
              ? 'Save final results'
              : `Save final fixture (${winnersPicked}/${courts} winners)`}
          </button>
        </section>
      )}

      {/* POINTS + STANDINGS PREVIEW */}
      {started && finals.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-bold text-white">Leaderboard points</h2>
          <p className="text-[12px] text-white/55 mt-1 mb-3">
            Points per player by final court. Edit if needed — the table used is stored with the tournament.
          </p>
          <div className="rounded-xl overflow-hidden mb-4" style={CARD}>
            <div className="grid grid-cols-[1fr_88px_88px] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
              <span>Court</span>
              <span className="text-center">Winner</span>
              <span className="text-center">Loser</span>
            </div>
            {courtNumbers.map(c => (
              <div key={c} className="grid grid-cols-[1fr_88px_88px] gap-2 px-4 py-2 items-center border-t" style={{ borderColor: '#2d5a40' }}>
                <span className="text-sm font-semibold text-white">Court {c}</span>
                {(['winner', 'loser'] as const).map(side => (
                  <input
                    key={side}
                    type="number"
                    step={1}
                    aria-label={`Court ${c} ${side} points`}
                    value={pointsRow(c)[side]}
                    onChange={e => setPoints(c, { [side]: e.target.value })}
                    className="w-full h-11 text-center text-base font-bold rounded-lg outline-none text-white"
                    style={{ ...INPUT, borderColor: toInt(pointsRow(c)[side]) === null ? '#ef4444' : '#2d5a40' }}
                  />
                ))}
              </div>
            ))}
          </div>

          <h2 className="text-base font-bold text-white mb-3">Final Standings {applied && appliedInSync ? '' : '· preview'}</h2>
          {finalDirty && (
            <p className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#facc15' }}>
              ⚠ You have unsaved changes in the final. Save them to update the standings.
            </p>
          )}
          {!pointsTable ? (
            <p className="text-sm text-red-200">Points must be whole numbers.</p>
          ) : !preview ? (
            <p className="text-sm text-white/60">Pick and save the winner of every court to see the final standings.</p>
          ) : (
            <>
              <LightsOutStandings standings={preview} teams={teamViews} />
              {applied && appliedInSync ? (
                <p className="mt-3 rounded-lg px-3 py-3 text-sm font-semibold text-center" style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#86efac' }}>
                  ✓ Points applied to the leaderboard
                  {tournament?.points_applied_at ? ` · ${new Date(tournament.points_applied_at).toLocaleString('en-GB')}` : ''}
                </p>
              ) : (
                <>
                  {applied && (
                    <p className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#facc15' }}>
                      ⚠ These standings differ from the points already applied. Confirming rolls the old points back and applies
                      these instead — nothing is counted twice.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={anyBusy || finalDirty}
                    className={`${bigButton} mt-3`}
                    style={{ backgroundColor: ORANGE }}
                  >
                    {busy === 'apply' ? 'Applying…' : applied ? '✓ Confirm & Re-apply Points' : '✓ Confirm & Apply Points'}
                  </button>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
