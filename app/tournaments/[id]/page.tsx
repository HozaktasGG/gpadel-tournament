import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import RegisterButton from './register-button'

type EventRow = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  max_players: number | null
  format: string | null
  status: string
  entry_fee: number | null
  description: string | null
}

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  skill_score: number | null
  skill_level: string | null
}

type Participant = {
  user_id: string
  profile: Profile | null
}

type TournamentMatchView = {
  id: string
  court_number: number
  team1_player1: string
  team1_player2: string
  team2_player1: string
  team2_player2: string
  team1_score: number | null
  team2_score: number | null
}

type TournamentRoundView = {
  roundNumber: number
  status: string
  matches: TournamentMatchView[]
}

type StandingView = {
  rank: number
  players: string[]
  bonus: number
}

type TournamentResultsView = {
  rounds: TournamentRoundView[]
  standings: StandingView[]
}

function formatDateLabel(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch { return dateStr }
}

function todayString() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function skillLevelStyle(level: string | null | undefined) {
  switch (level) {
    case 'Advanced':     return { bg: 'rgba(249,115,22,0.2)', color: '#f97316' }
    case 'Intermediate': return { bg: 'rgba(34,197,94,0.2)',  color: '#22c55e' }
    case 'Beginner':     return { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' }
    default:             return { bg: 'rgba(107,114,128,0.2)', color: '#6b7280' }
  }
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

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!event) notFound()
  const ev = event as EventRow

  const { data: { user } } = await supabase.auth.getUser()

  const { count: registeredCount } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', ev.id)
    .eq('status', 'approved')

  let isRegistered = false
  let registrationId: string | null = null
  let participants: Participant[] | null = null

  if (user) {
    const { data: myReg } = await supabase
      .from('event_registrations')
      .select('id, status')
      .eq('event_id', ev.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (myReg?.status === 'approved') {
      isRegistered = true
      registrationId = myReg.id
    }

    // Two-query approach — works regardless of FK constraints
    const { data: regRows, error: regError } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', ev.id)
      .eq('status', 'approved')

    if (regError) {
      console.error('Registrations error:', regError)
    } else if (regRows && regRows.length > 0) {
      const userIds = regRows.map(r => r.user_id)
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, skill_score, skill_level')
        .in('id', userIds)

      if (profileError) {
        console.error('Profiles error:', profileError)
      }

      const profileMap = new Map((profileRows ?? []).map(p => [p.id, p as Profile]))
      participants = regRows.map(r => ({
        user_id: r.user_id,
        profile: profileMap.get(r.user_id) ?? null,
      }))
    } else {
      participants = []
    }
  }

  const sorted = participants
    ? [...participants].sort(
        (a, b) => (b.profile?.skill_score ?? 0) - (a.profile?.skill_score ?? 0)
      )
    : null

  const capacity = ev.max_players ?? 0
  const filled = registeredCount ?? 0
  const remaining = Math.max(0, capacity - filled)
  const isFull = capacity > 0 && filled >= capacity
  const isFinished = ev.date < todayString() || ev.status === 'finished' || ev.status === 'completed'

  let tournamentResults: TournamentResultsView | null = null
  if (ev.status === 'completed') {
    const { data: completedTournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (completedTournament) {
      const tournamentId = completedTournament.id
      const [matchesRes, roundsRes] = await Promise.all([
        supabase
          .from('tournament_matches')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('court_number', { ascending: true }),
        supabase
          .from('tournament_rounds')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('round_number', { ascending: true }),
      ])

      const matches = matchesRes.data ?? []
      const rounds = roundsRes.data ?? []

      const roundNumberById = new Map<string, number>(
        rounds.map((r: any) => [r.id, r.round_number])
      )

      const matchesByRoundNumber = new Map<number, any[]>()
      for (const m of matches as any[]) {
        const rn = roundNumberById.get(m.round_id)
        if (rn != null) {
          if (!matchesByRoundNumber.has(rn)) matchesByRoundNumber.set(rn, [])
          matchesByRoundNumber.get(rn)!.push(m)
        }
      }

      const groupedRounds: TournamentRoundView[] = rounds.map((r: any) => ({
        roundNumber: r.round_number,
        status: r.status,
        matches: (matchesByRoundNumber.get(r.round_number) ?? [])
          .sort((a: any, b: any) => a.court_number - b.court_number)
          .map((m: any) => ({
            id: m.id,
            court_number: m.court_number,
            team1_player1: m.team1_player1 ?? '—',
            team1_player2: m.team1_player2 ?? '—',
            team2_player1: m.team2_player1 ?? '—',
            team2_player2: m.team2_player2 ?? '—',
            team1_score: m.team1_score,
            team2_score: m.team2_score,
          })),
      }))

      // Final Standings — Round 4 kort sonuçlarına göre
      const round4Id = (rounds as any[]).find((r: any) => r.round_number === 4)?.id
      const round4Matches = (matches as any[])
        .filter(m => m.round_id === round4Id)
        .sort((a: any, b: any) => a.court_number - b.court_number)

      const bonusMap: Record<number, { winner: number; loser: number }> = {
        1: { winner: 80, loser: 50 },
        2: { winner: 30, loser: 10 },
        3: { winner: -5, loser: -15 },
      }

      const standings: StandingView[] = []
      for (const match of round4Matches) {
        const bonus = bonusMap[match.court_number]
        if (!bonus) continue
        const team1 = [match.team1_player1, match.team1_player2]
          .filter(Boolean)
          .map((n: string) => normalizeName(n))
        const team2 = [match.team2_player1, match.team2_player2]
          .filter(Boolean)
          .map((n: string) => normalizeName(n))
        const t1 = match.team1_score ?? 0
        const t2 = match.team2_score ?? 0
        const team1Won = t1 > t2
        const winnerTeam = team1Won ? team1 : team2
        const loserTeam = team1Won ? team2 : team1
        const baseRank = (match.court_number - 1) * 2 + 1
        standings.push({ rank: baseRank, players: winnerTeam, bonus: bonus.winner })
        standings.push({ rank: baseRank + 1, players: loserTeam, bonus: bonus.loser })
      }
      standings.sort((a, b) => a.rank - b.rank)

      tournamentResults = { rounds: groupedRounds, standings }
    }
  }

  return (
    <main className="flex-1 py-12 px-4 sm:px-6" style={{ backgroundColor: '#1a3d2e' }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/tournaments" className="text-sm text-white/60 hover:text-white mb-6 inline-block">
          ← All tournaments
        </Link>

        <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Header */}
          <div className="px-6 sm:px-8 py-8" style={{ background: 'linear-gradient(180deg,#204a38 0%,#0f2a1f 100%)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full"
                style={{
                  backgroundColor: isFinished ? 'rgba(255,255,255,0.08)' : ev.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(255,107,53,0.15)',
                  color: isFinished ? 'rgba(255,255,255,0.5)' : ev.status === 'active' ? '#22c55e' : '#ff6b35',
                }}
              >
                {isFinished ? 'Finished' : ev.status === 'active' ? '● Live' : 'Upcoming'}
              </span>
              {ev.format && <span className="text-[10px] text-white/40 font-semibold">{ev.format}</span>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">{ev.name}</h1>
            {ev.status === 'active' && (
              <Link
                href="/tournament"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white transition hover:brightness-110"
                style={{ backgroundColor: '#ef4444' }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#fff', animation: 'pulse 1.5s infinite' }}
                />
                Watch Live →
              </Link>
            )}
          </div>

          {/* Details */}
          <div className="px-6 sm:px-8 py-6 space-y-3">
            <div className="flex items-center gap-3 text-white">
              <span className="text-lg">📅</span>
              <span className="text-sm">{formatDateLabel(ev.date)}</span>
            </div>
            {ev.time && (
              <div className="flex items-center gap-3 text-white">
                <span className="text-lg">🕐</span>
                <span className="text-sm">{ev.time}</span>
              </div>
            )}
            {ev.location && (
              <div className="flex items-center gap-3 text-white">
                <span className="text-lg">📍</span>
                <span className="text-sm">{ev.location}</span>
              </div>
            )}
            {ev.entry_fee != null && (
              <div className="flex items-center gap-3 text-white">
                <span className="text-lg">💰</span>
                <span className="text-sm">{ev.entry_fee ? `€${ev.entry_fee} per person` : 'Free entry'}</span>
              </div>
            )}
          </div>

          {ev.description && (
            <div className="px-6 sm:px-8 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm text-white/75 leading-relaxed">{ev.description}</p>
            </div>
          )}

          {/* Participants */}
          <div className="px-6 sm:px-8 py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="mb-4">
              <p className="text-3xl font-bold text-white leading-none">
                {capacity > 0 ? `${filled} / ${capacity}` : filled}
              </p>
              <p className="text-xs text-white/50 mt-1">
                {capacity > 0 ? (isFull ? 'Full — Spots Filled' : `Spots Filled · ${remaining} left`) : 'Spots Filled'}
              </p>
            </div>

            {!user ? (
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-sm text-white/70">
                  <Link href={`/signin?redirect=/tournaments/${ev.id}`} className="font-semibold underline" style={{ color: '#ff6b35' }}>
                    Sign in
                  </Link>{' '}
                  to see participants
                </p>
              </div>
            ) : sorted && sorted.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                  Participants ({sorted.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {sorted.map((p, i) => {
                    const prof = p.profile
                    const firstName = prof?.first_name ?? ''
                    const lastName = prof?.last_name ?? ''
                    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Player'
                    const initial = (firstName[0] ?? name[0] ?? '?').toUpperCase()
                    const level = prof?.skill_level ?? null
                    const score = prof?.skill_score ?? 0
                    const { bg: levelBg, color: levelColor } = skillLevelStyle(level)

                    const borderStyle =
                      i === 0 ? '2px solid #f59e0b'
                      : i === 1 ? '2px solid #9ca3af'
                      : i === 2 ? '2px solid #92400e'
                      : '1px solid rgba(255,255,255,0.06)'

                    const bgStyle =
                      i === 0 ? 'rgba(245,158,11,0.06)'
                      : i === 1 ? 'rgba(156,163,175,0.06)'
                      : i === 2 ? 'rgba(146,64,14,0.06)'
                      : 'rgba(255,255,255,0.03)'

                    return (
                      <div
                        key={p.user_id}
                        className="rounded-xl px-3 py-3 flex flex-col gap-2"
                        style={{ backgroundColor: bgStyle, border: borderStyle }}
                      >
                        <div className="flex items-center gap-2">
                          {prof?.avatar_url ? (
                            <img
                              src={prof.avatar_url}
                              alt={name}
                              width={32}
                              height={32}
                              className="rounded-full object-cover flex-shrink-0"
                              style={{ width: 32, height: 32 }}
                            />
                          ) : (
                            <span
                              className="flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ width: 32, height: 32, backgroundColor: '#ff6b35', fontSize: 12 }}
                            >
                              {initial}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              {i < 3 && (
                                <span className="text-sm leading-none flex-shrink-0">
                                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                </span>
                              )}
                              <span className="text-sm font-semibold text-white truncate">{name}</span>
                            </div>
                          </div>
                        </div>
                        {level && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full self-start"
                            style={{ backgroundColor: levelBg, color: levelColor }}
                          >
                            {level}
                          </span>
                        )}
                        {score > 0 && (
                          <span className="text-[11px] text-white/50">{score} pts</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/50 text-center py-3">No participants yet.</p>
            )}
          </div>

          {/* Match Results (completed events only) */}
          {ev.status === 'completed' && tournamentResults && (
            <div className="px-6 sm:px-8 py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">
                Match Results
              </p>

              {/* Final Standings — Round 4 kort sonuçlarına göre */}
              {tournamentResults.standings.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-white/90 mb-3">🏆 Final Standings</h3>
                  <div className="space-y-2">
                    {tournamentResults.standings.map(s => {
                      const bonusColor = s.bonus > 0 ? '#4ade80' : s.bonus < 0 ? '#f87171' : 'rgba(255,255,255,0.7)'
                      const bonusLabel = s.bonus > 0 ? `+${s.bonus}` : String(s.bonus)
                      const ordinal = (n: number) => {
                        const s2 = ['th', 'st', 'nd', 'rd']
                        const v = n % 100
                        return n + (s2[(v - 20) % 10] || s2[v] || s2[0])
                      }
                      const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : null
                      const borderColor =
                        s.rank === 1 ? '#d4af37'
                        : s.rank === 2 ? '#c0c0c0'
                        : s.rank === 3 ? '#cd7f32'
                        : 'rgba(255,255,255,0.08)'
                      const borderWidth = s.rank <= 3 ? '2px' : '1px'
                      const bgColor =
                        s.rank === 1 ? 'rgba(212,175,55,0.08)'
                        : s.rank === 2 ? 'rgba(192,192,192,0.08)'
                        : s.rank === 3 ? 'rgba(205,127,50,0.08)'
                        : '#0f2a1f'
                      return (
                        <div
                          key={s.rank}
                          className="rounded-xl px-4 py-3 flex items-center gap-3"
                          style={{
                            backgroundColor: bgColor,
                            border: `${borderWidth} solid ${borderColor}`,
                          }}
                        >
                          <span className="text-lg w-6 text-center flex-shrink-0">
                            {medal ?? <span className="text-white/40 text-xs font-bold">{s.rank}</span>}
                          </span>
                          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider w-20 flex-shrink-0">
                            {ordinal(s.rank)} Place
                          </span>
                          <span className="flex-1 text-sm font-semibold text-white truncate">
                            {s.players.join(' & ')}
                          </span>
                          <span
                            className="text-sm font-bold tabular-nums flex-shrink-0"
                            style={{ color: bonusColor }}
                          >
                            {bonusLabel}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Round Results (R1-R3) */}
              {(() => {
                const groupRounds = tournamentResults.rounds.filter(r => r.roundNumber <= 3)
                const finalRound = tournamentResults.rounds.find(r => r.roundNumber === 4)
                const renderMatch = (m: TournamentMatchView) => {
                  const t1 = m.team1_score ?? 0
                  const t2 = m.team2_score ?? 0
                  const team1Wins = m.team1_score != null && m.team2_score != null && t1 > t2
                  const team2Wins = m.team1_score != null && m.team2_score != null && t2 > t1
                  const team1Color = team1Wins ? '#4ade80' : '#fff'
                  const team2Color = team2Wins ? '#4ade80' : '#fff'
                  const team1Weight = team1Wins ? 700 : 500
                  const team2Weight = team2Wins ? 700 : 500
                  return (
                    <div
                      key={m.id}
                      className="px-4 py-3 flex items-center gap-3 border-t"
                      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                    >
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md flex-shrink-0"
                        style={{ backgroundColor: 'rgba(255,107,53,0.15)', color: '#ff6b35' }}
                      >
                        C{m.court_number}
                      </span>
                      <div
                        className="flex-1 text-xs leading-tight"
                        style={{ color: team1Color, fontWeight: team1Weight }}
                      >
                        {m.team1_player1} + {m.team1_player2}
                      </div>
                      <div className="text-xs font-bold text-white tabular-nums min-w-[46px] text-center">
                        {m.team1_score ?? '—'}:{m.team2_score ?? '—'}
                      </div>
                      <div
                        className="flex-1 text-xs leading-tight text-right"
                        style={{ color: team2Color, fontWeight: team2Weight }}
                      >
                        {m.team2_player1} + {m.team2_player2}
                      </div>
                    </div>
                  )
                }
                return (
                  <>
                    {groupRounds.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-white/90 mb-3">Round Results</h3>
                        <div className="space-y-4">
                          {groupRounds.map(round => (
                            <div
                              key={round.roundNumber}
                              className="rounded-xl overflow-hidden"
                              style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              <div
                                className="flex items-center justify-between px-4 py-3"
                                style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                              >
                                <p className="text-sm font-semibold text-white">Round {round.roundNumber}</p>
                                <span
                                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
                                >
                                  Completed
                                </span>
                              </div>
                              {round.matches.length === 0 ? (
                                <p className="px-4 py-4 text-xs text-white/50">No matches recorded.</p>
                              ) : (
                                <div>{round.matches.map(renderMatch)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {finalRound && (
                      <div>
                        <h3 className="text-sm font-semibold text-white/90 mb-3">Final Round Results</h3>
                        <div
                          className="rounded-xl overflow-hidden"
                          style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          <div
                            className="flex items-center justify-between px-4 py-3"
                            style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                          >
                            <p className="text-sm font-semibold text-white">
                              Round 4 <span className="text-xs text-white/50">(Final — by ranking)</span>
                            </p>
                            <span
                              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
                            >
                              Completed
                            </span>
                          </div>
                          {finalRound.matches.length === 0 ? (
                            <p className="px-4 py-4 text-xs text-white/50">No matches recorded.</p>
                          ) : (
                            <div>{finalRound.matches.map(renderMatch)}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Registration CTA */}
          <div className="px-6 sm:px-8 pb-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {isFinished ? (
              <p className="mt-6 text-sm text-white/60 text-center">This tournament has finished.</p>
            ) : !user ? (
              <div className="mt-6 text-center">
                <Link
                  href={`/signin?redirect=/tournaments/${ev.id}`}
                  className="inline-block px-8 py-3 rounded-full text-sm font-bold text-white transition hover:brightness-110"
                  style={{ backgroundColor: '#ff6b35' }}
                >
                  Sign in to register
                </Link>
                <p className="mt-3 text-xs text-white/50">
                  Don't have an account?{' '}
                  <Link href="/signup" className="underline">Sign up free</Link>
                </p>
              </div>
            ) : (
              <div className="mt-6">
                <RegisterButton
                  eventId={ev.id}
                  isRegistered={isRegistered}
                  registrationId={registrationId}
                  isFull={isFull}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
