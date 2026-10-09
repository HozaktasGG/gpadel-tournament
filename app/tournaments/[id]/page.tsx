import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, Clock, Euro, FileText, Lock, MapPin, Trophy, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { isTeamFormat as isTeamFormatValue } from '@/lib/event-format'
import { formatEventDate, formatPrice, isEventLive } from '@/lib/event-status'
import { finalPlacements, groupStandings, knockoutRounds, teamAmericanoStandings, type TeamGroupRow, type TeamMatch } from '@/lib/team-standings'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FeaturedTag, FormatBadge, LivePill, Badge } from '@/components/ui/badge'
import { CapacityBar } from '@/components/ui/capacity-bar'
import { PlayerRow, RankMedal } from '@/components/ui/player-row'
import { TeamPairCard } from '@/components/ui/team-pair-card'
import { EmptyState } from '@/components/ui/empty-state'
import { ShareEventButton } from '@/components/event-actions'
import { FadeUpItem, Stagger } from '@/components/motion'
import { DetailTabs, ExpandableList, HeroControls, type DetailTab } from './detail-client'
import { RegistrationActions, type RegistrationProps, type TeamRegState } from './registration-actions'
import { KnockoutBracket, MatchCard, PlacementList, StandingsTable, type TeamInfo } from './team-views'
import type { SheetPlayer } from './partner-sheet'

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
  pdf_url: string | null
  image_url: string | null
  registration_open: boolean | null
  featured?: boolean | null
  subtitle?: string | null
}

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  skill_score: number | null
  skill_level: string | null
  player_code?: string | null
}

type Participant = {
  user_id: string
  profile: Profile | null
}

type ApprovedTeam = {
  id: string
  team_name: string
  captain_id: string | null
  partner_id: string | null
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

function todayString() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const personName = (p: Pick<Profile, 'first_name' | 'last_name'> | null | undefined) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || 'Player'

async function loadInitialTeamRegistration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  userId: string
): Promise<TeamRegState | null> {
  const { data: existingReg } = await supabase
    .from('team_registrations')
    .select('id, status, team_name, captain_id')
    .eq('event_id', eventId)
    .or(`captain_id.eq.${userId},partner_id.eq.${userId}`)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<TeamRegState>()
  return existingReg ?? null
}

// Unchanged from the previous page: results of the last completed live-scoring
// tournament, shown on completed events.
async function loadTournamentResults(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<TournamentResultsView | null> {
  let tournamentResults: TournamentResultsView | null = null
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

    // Final Standings — based on Round 4 court results
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
  return tournamentResults
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('name, description').eq('id', id).maybeSingle()
  if (!data) return {}
  return { title: `${data.name} · SmashTorino`, description: data.description ?? undefined }
}

const FORMAT_FACTS: Record<string, { icon: typeof Users; text: string }[]> = {
  Americano: [
    { icon: Users, text: 'Americano uses rotating partners' },
    { icon: Trophy, text: 'Individual ranking points' },
  ],
  'Team Americano': [
    { icon: Users, text: 'Team of 2 players' },
    { icon: Lock, text: 'Both players must accept' },
    { icon: Trophy, text: 'Round robin + placement finals' },
  ],
  Team: [
    { icon: Users, text: 'Team of 2 players' },
    { icon: Lock, text: 'Both players must accept' },
    { icon: Trophy, text: 'Group stage + knockout' },
  ],
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

  const isTeamFormat = isTeamFormatValue(ev.format)
  const registrationOpen = ev.registration_open !== false

  let isRegistered = false
  let registrationId: string | null = null
  let participants: Participant[] | null = null
  let approvedTeams: ApprovedTeam[] = []
  let teamPlayerProfiles: Map<string, Profile> = new Map()
  let filled = 0

  if (isTeamFormat) {
    const { count: teamCount } = await supabase
      .from('team_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', ev.id)
      .eq('status', 'approved')
    filled = (teamCount ?? 0) * 2

    if (user) {
      const { data: teamsData } = await supabase
        .from('team_registrations')
        .select('id, team_name, captain_id, partner_id')
        .eq('event_id', ev.id)
        .eq('status', 'approved')
      approvedTeams = (teamsData ?? []) as ApprovedTeam[]

      const playerIds = approvedTeams
        .flatMap(t => [t.captain_id, t.partner_id])
        .filter((p): p is string => !!p)

      if (playerIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, skill_score, skill_level, player_code')
          .in('id', playerIds)
        teamPlayerProfiles = new Map(
          ((profileRows ?? []) as Profile[]).map(p => [p.id, p])
        )
      }
    }
  } else {
    const { count: registeredCount } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', ev.id)
      .eq('status', 'approved')
    filled = registeredCount ?? 0

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
          .select('id, first_name, last_name, avatar_url, skill_score, skill_level, player_code')
          .in('id', userIds)

        if (profileError) {
          console.error('Profiles error:', profileError)
        }

        const profileMap = new Map(((profileRows ?? []) as Profile[]).map(p => [p.id, p]))
        participants = regRows.map(r => ({
          user_id: r.user_id,
          profile: profileMap.get(r.user_id) ?? null,
        }))
      } else {
        participants = []
      }
    }
  }

  const sorted = participants
    ? [...participants].sort(
        (a, b) => (b.profile?.skill_score ?? 0) - (a.profile?.skill_score ?? 0)
      )
    : null

  const capacity = ev.max_players ?? 0
  const isFull = capacity > 0 && filled >= capacity
  const isFinished = ev.date < todayString() || ev.status === 'finished' || ev.status === 'completed'

  const tournamentResults = ev.status === 'completed' ? await loadTournamentResults(supabase) : null

  // --- Read-only additions for the redesign ---------------------------------
  const [{ data: activeTournament }, teamReg, meRow, groupRows, matchRows] = await Promise.all([
    supabase.from('tournaments').select('id').eq('status', 'active').limit(1).maybeSingle(),
    isTeamFormat && user ? loadInitialTeamRegistration(supabase, ev.id, user.id) : Promise.resolve(null),
    isTeamFormat && user
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, skill_score, skill_level, player_code')
          .eq('id', user.id)
          .maybeSingle()
          .then(r => r.data as SheetPlayer | null)
      : Promise.resolve(null),
    isTeamFormat && user
      ? supabase
          .from('team_tournament_groups')
          .select('team_registration_id, group_name, position')
          .eq('event_id', ev.id)
          .then(r => (r.data ?? []) as TeamGroupRow[])
      : Promise.resolve([] as TeamGroupRow[]),
    isTeamFormat && user
      ? supabase
          .from('team_tournament_matches')
          .select('id, phase, group_name, round_number, team1_id, team2_id, team1_score, team2_score, winner_id, match_order')
          .eq('event_id', ev.id)
          .then(r => (r.data ?? []) as TeamMatch[])
      : Promise.resolve([] as TeamMatch[]),
  ])

  const live = isEventLive(ev, !!activeTournament) || ev.status === 'active'
  const priceLabel = formatPrice(ev.entry_fee)
  const subtitle = ev.subtitle?.trim() || (ev.format === 'Team' ? 'Team Tournament' : `${ev.format ?? 'Americano'} Tournament`)
  // image_url is usually an organizer/collab logo, so it is shown as a badge, never cropped as a cover.
  const cover = '/hero-bg.jpg'
  const facts = FORMAT_FACTS[ev.format ?? 'Americano'] ?? FORMAT_FACTS.Americano

  // Team lookups (approved teams only, as before).
  const teamById = new Map<string, TeamInfo>(
    approvedTeams.map(t => {
      const a = t.captain_id ? teamPlayerProfiles.get(t.captain_id) : undefined
      const b = t.partner_id ? teamPlayerProfiles.get(t.partner_id) : undefined
      return [
        t.id,
        {
          id: t.id,
          name: t.team_name,
          a: { name: personName(a), avatarUrl: a?.avatar_url ?? null },
          b: { name: personName(b), avatarUrl: b?.avatar_url ?? null },
        },
      ]
    })
  )
  const team = (tid: string | null) => (tid ? teamById.get(tid) ?? null : null)

  const registration: RegistrationProps = {
    event: {
      id: ev.id,
      name: ev.name,
      date: ev.date,
      time: ev.time,
      location: ev.location,
      description: ev.description,
      format: ev.format,
      url: `/tournaments/${ev.id}`,
    },
    isTeam: isTeamFormat,
    userId: user?.id ?? null,
    me: meRow,
    priceLabel,
    isFinished,
    registrationOpen,
    isRegistered,
    registrationId,
    isFull,
    teamRegistration: teamReg,
  }

  // ---------------------------------------------------------------------------
  // Building blocks

  const infoRows = (
    <ul className="divide-y divide-border">
      <InfoRow icon={CalendarDays}>{formatEventDate(ev.date)}</InfoRow>
      {ev.time && <InfoRow icon={Clock}>{ev.time}</InfoRow>}
      <li className="grid grid-cols-2 divide-x divide-border">
        {ev.location && (
          <span className="flex min-h-11 items-center gap-3 py-2 pr-3">
            <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate">{ev.location}</span>
          </span>
        )}
        {priceLabel && (
          <span className="flex min-h-11 items-center gap-3 py-2 pl-4">
            <Euro className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span>{priceLabel === 'Free' ? 'Free entry' : `${priceLabel} per person`}</span>
          </span>
        )}
      </li>
    </ul>
  )

  const signInPrompt = (what: string) => (
    <EmptyState
      icon={Lock}
      title={`Sign in to see ${what}`}
      action={
        <Button asChild variant="secondary">
          <Link href={`/signin?redirect=/tournaments/${ev.id}`}>Sign in</Link>
        </Button>
      }
    />
  )

  const aboutSection = (ev.description || ev.pdf_url) && (
    <Card className="p-5">
      <h2 className="font-display text-[22px] font-semibold">About this tournament</h2>
      {ev.description && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{ev.description}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="muted" size="md">
          Format · {ev.format ?? 'Americano'}
        </Badge>
        {ev.pdf_url && (
          <Button asChild variant="secondary" size="sm">
            <a href={ev.pdf_url} target="_blank" rel="noopener noreferrer">
              <FileText />
              Tournament info (PDF)
            </a>
          </Button>
        )}
      </div>
    </Card>
  )

  const capacityBlock = capacity > 0 && (
    <CapacityBar
      filled={isTeamFormat ? filled / 2 : filled}
      capacity={isTeamFormat ? Math.floor(capacity / 2) : capacity}
      unit={isTeamFormat ? 'teams' : 'spots'}
      tone="primary"
      layout="detailed"
    />
  )

  // Mobile-only registration status card (holds "Cancel" etc. that don't fit in the sticky bar).
  const myRegistrationCard = user && !isFinished && (isRegistered || teamReg) && (
    <Card className="p-4 lg:hidden">
      <p className="mb-3 text-overline font-semibold uppercase text-subtle">Your registration</p>
      <RegistrationActions {...registration} variant="card" />
    </Card>
  )

  // --- Individual (Americano) tabs ------------------------------------------
  const playersTab = !user ? (
    signInPrompt('participants')
  ) : sorted && sorted.length > 0 ? (
    <section aria-labelledby="players-h">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="players-h" className="font-display text-[22px] font-semibold">Players</h2>
        <p className="text-sm text-muted-foreground">{sorted.length} registered</p>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">Top rated players</p>
      <ExpandableList total={sorted.length}>
        {sorted.map((p, i) => (
          <PlayerRow
            key={p.user_id}
            rank={i + 1}
            name={personName(p.profile)}
            avatarUrl={p.profile?.avatar_url}
            skillLevel={p.profile?.skill_level ?? null}
            rating={p.profile?.skill_score ?? null}
          />
        ))}
      </ExpandableList>
    </section>
  ) : (
    <EmptyState icon={Users} title="No players yet" description="Be the first to register." />
  )

  const resultsTab = tournamentResults && (
    <div className="space-y-6">
      {tournamentResults.standings.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-[22px] font-semibold">Final standings</h2>
          <ol className="space-y-2">
            {tournamentResults.standings.map(s => (
              <li key={s.rank} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-border bg-pitch-850 px-3">
                <RankMedal rank={s.rank} />
                <span className="min-w-0 flex-1 truncate font-medium">{s.players.join(' & ')}</span>
                <span className={cn('font-display text-lg font-semibold tabular', s.bonus > 0 ? 'text-success' : s.bonus < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {s.bonus > 0 ? `+${s.bonus}` : s.bonus}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {tournamentResults.rounds.map(r => (
        <section key={r.roundNumber}>
          <h3 className="mb-2 font-display text-lg font-semibold">
            Round {r.roundNumber}
            {r.roundNumber === 4 && <span className="ml-2 text-sm font-normal text-muted-foreground">Final · court placement</span>}
          </h3>
          <div className="overflow-hidden rounded-xl border border-border bg-pitch-850">
            {r.matches.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No matches recorded.</p>
            ) : (
              r.matches.map(m => (
                <div key={m.id} className="flex items-center gap-3 border-b border-border px-3 py-2.5 text-sm last:border-0">
                  <span className="w-7 shrink-0 font-display font-semibold text-primary-text">C{m.court_number}</span>
                  <span className="min-w-0 flex-1 truncate">{m.team1_player1} + {m.team1_player2}</span>
                  <span className="shrink-0 font-display text-base font-bold tabular">
                    {m.team1_score ?? '–'}:{m.team2_score ?? '–'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right">{m.team2_player1} + {m.team2_player2}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  )

  const detailsTab = (
    <div className="space-y-4">
      {myRegistrationCard}
      {aboutSection}
      {!aboutSection && !myRegistrationCard && (
        <EmptyState icon={FileText} title="No extra details yet" description="The organizer hasn't added a description." />
      )}
    </div>
  )

  // --- Team tabs --------------------------------------------------------------
  const groupNames = Array.from(new Set(groupRows.map(g => g.group_name))).sort()
  const groupMatches = matchRows.filter(m => m.phase === 'group')
  const knockout = knockoutRounds(matchRows)
  const isTeamAmericano = ev.format === 'Team Americano'
  const taStandings = isTeamAmericano
    ? teamAmericanoStandings(approvedTeams.map(t => t.id), groupMatches, tid => teamById.get(tid)?.name ?? '')
    : []
  const taFinals = isTeamAmericano ? matchRows.filter(m => m.phase === 'final') : []
  const taPlacements = finalPlacements(taFinals)

  const yourTeam = (() => {
    if (!teamReg) return null
    const approved = approvedTeams.find(t => t.id === teamReg.id)
    if (approved) {
      const a = approved.captain_id ? teamPlayerProfiles.get(approved.captain_id) : undefined
      const b = approved.partner_id ? teamPlayerProfiles.get(approved.partner_id) : undefined
      return (
        <TeamPairCard
          teamName={approved.team_name}
          captain={{ name: personName(a), avatarUrl: a?.avatar_url, skillLevel: a?.skill_level ?? null, rating: a?.skill_score ?? null }}
          partner={b ? { name: personName(b), avatarUrl: b.avatar_url, skillLevel: b.skill_level ?? null, rating: b.skill_score ?? null } : null}
        />
      )
    }
    return null
  })()

  const groupTables = groupNames.length > 0 && (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {groupNames.map(g => (
        <StandingsTable key={g} title={`Group ${g}`} rows={groupStandings(g, groupRows, matchRows)} team={team} highlightTop={knockout.length ? 2 : 0} />
      ))}
    </div>
  )

  const noFixtures = (
    <EmptyState icon={Trophy} title="Fixtures aren't out yet" description="Groups and matches appear here once the organizer draws them." />
  )

  const teamsTab = !user ? (
    signInPrompt('teams')
  ) : approvedTeams.length > 0 ? (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[22px] font-semibold">Teams</h2>
        <p className="text-sm text-muted-foreground">{approvedTeams.length} confirmed</p>
      </div>
      <Stagger className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {approvedTeams.map(t => {
          const a = t.captain_id ? teamPlayerProfiles.get(t.captain_id) : undefined
          const b = t.partner_id ? teamPlayerProfiles.get(t.partner_id) : undefined
          return (
            <FadeUpItem key={t.id}>
              <TeamPairCard
                teamName={t.team_name}
                captain={{ name: personName(a), avatarUrl: a?.avatar_url, skillLevel: a?.skill_level ?? null, rating: a?.skill_score ?? null }}
                partner={b ? { name: personName(b), avatarUrl: b.avatar_url, skillLevel: b.skill_level ?? null, rating: b.skill_score ?? null } : null}
              />
            </FadeUpItem>
          )
        })}
      </Stagger>
    </section>
  ) : (
    <EmptyState icon={Users} title="No teams yet" description="Register with a partner to claim the first spot." />
  )

  const overviewTab = (
    <div className="space-y-6">
      {myRegistrationCard}
      {yourTeam && (
        <section>
          <h2 className="mb-3 font-display text-[22px] font-semibold">Your team</h2>
          {yourTeam}
        </section>
      )}
      {isTeamAmericano
        ? taPlacements.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-[22px] font-semibold">Final standings</h2>
              <PlacementList placements={taPlacements.slice(0, 4)} team={team} />
            </section>
          )
        : user &&
          groupTables && (
            <section>
              <h2 className="mb-3 font-display text-[22px] font-semibold">Group stage</h2>
              {groupTables}
            </section>
          )}
      {!isTeamAmericano && user && knockout.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-[22px] font-semibold">Knockout bracket</h2>
          <KnockoutBracket rounds={knockout} team={team} />
        </section>
      )}
      {aboutSection}
      {!user && signInPrompt('teams and fixtures')}
      {user && !myRegistrationCard && !yourTeam && !aboutSection && groupNames.length === 0 && taPlacements.length === 0 && noFixtures}
    </div>
  )

  const groupsTab = !user ? (
    signInPrompt('groups')
  ) : groupNames.length === 0 ? (
    noFixtures
  ) : (
    <div className="space-y-8">
      {groupNames.map(g => (
        <section key={g} className="space-y-3">
          <StandingsTable title={`Group ${g}`} rows={groupStandings(g, groupRows, matchRows)} team={team} highlightTop={knockout.length ? 2 : 0} />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {groupMatches
              .filter(m => m.group_name === g)
              .sort((a, b) => (a.round_number ?? 0) - (b.round_number ?? 0) || (a.match_order ?? 0) - (b.match_order ?? 0))
              .map(m => (
                <MatchCard key={m.id} m={m} team={team} label={m.round_number ? `Round ${m.round_number}` : undefined} />
              ))}
          </div>
        </section>
      ))}
    </div>
  )

  const knockoutTab = !user ? signInPrompt('the bracket') : knockout.length === 0 ? noFixtures : <KnockoutBracket rounds={knockout} team={team} />

  const taMatchesTab = !user ? (
    signInPrompt('matches')
  ) : groupMatches.length === 0 ? (
    noFixtures
  ) : (
    <div className="space-y-6">
      <StandingsTable title="Standings" rows={taStandings} team={team} />
      {Array.from(new Set(groupMatches.map(m => m.round_number ?? 0)))
        .sort((a, b) => a - b)
        .map(rn => (
          <section key={rn}>
            <h3 className="mb-2 font-display text-lg font-semibold">Round {rn}</h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {groupMatches
                .filter(m => (m.round_number ?? 0) === rn)
                .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))
                .map(m => (
                  <MatchCard key={m.id} m={m} team={team} />
                ))}
            </div>
          </section>
        ))}
    </div>
  )

  const taFinalsTab = !user ? (
    signInPrompt('the finals')
  ) : taFinals.length === 0 ? (
    noFixtures
  ) : (
    <div className="space-y-6">
      {taPlacements.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-[22px] font-semibold">Final standings</h2>
          <PlacementList placements={taPlacements} team={team} />
        </section>
      )}
      <section>
        <h3 className="mb-2 font-display text-lg font-semibold">Placement matches</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {[...taFinals]
            .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))
            .map(m => {
              const base = ((m.match_order ?? 1) - 1) * 2 + 1
              return <MatchCard key={m.id} m={m} team={team} label={m.match_order === 1 ? 'Final · 1st / 2nd' : `${ordinal(base)} / ${ordinal(base + 1)} place`} />
            })}
        </div>
      </section>
    </div>
  )

  const tabs: DetailTab[] = isTeamFormat
    ? isTeamAmericano
      ? [
          { value: 'overview', label: 'Overview', content: overviewTab },
          { value: 'teams', label: 'Teams', content: teamsTab },
          { value: 'matches', label: 'Matches', content: taMatchesTab },
          { value: 'finals', label: 'Finals', content: taFinalsTab },
        ]
      : [
          { value: 'overview', label: 'Overview', content: overviewTab },
          { value: 'teams', label: 'Teams', content: teamsTab },
          { value: 'groups', label: 'Groups', content: groupsTab },
          { value: 'knockout', label: 'Knockout', content: knockoutTab },
        ]
    : [
        { value: 'details', label: 'Details', content: detailsTab },
        { value: 'players', label: 'Players', content: playersTab },
        ...(resultsTab ? [{ value: 'results', label: 'Results', content: resultsTab }] : []),
      ]

  // ---------------------------------------------------------------------------

  return (
    <main className="flex-1 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-16">
      {/* Hero */}
      <div className="relative md:mx-auto md:mt-6 md:max-w-[1200px] md:px-8">
        <div className="relative overflow-hidden md:rounded-3xl md:border md:border-border">
          <div className="relative h-[340px] md:h-[300px]">
            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent max-md:hidden" />
          </div>
          <HeroControls title={ev.name} />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 md:px-8 md:pb-6">
            {ev.image_url && (
              <img
                src={ev.image_url}
                alt=""
                className="mb-3 size-16 rounded-full border-2 border-white/80 bg-white object-contain shadow-elevated md:size-20"
              />
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <FormatBadge format={ev.format} />
              {ev.featured && <FeaturedTag />}
              {live && <LivePill />}
              {isFinished && !live && <Badge size="sm" className="border-white/20 bg-black/55 text-foreground backdrop-blur-sm">Finished</Badge>}
            </div>
            <h1 className="max-w-3xl text-balance font-display text-[36px] font-bold leading-[0.95] tracking-tight md:text-hero-lg">{ev.name}</h1>
            <p className="mt-1.5 font-display text-xl font-medium text-success md:text-2xl">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="mt-4 grid grid-cols-1 gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          {/* Main column */}
          <div className="min-w-0 space-y-5">
            <Card className="px-4 text-[15px] md:px-5">{infoRows}</Card>
            {ev.description && <p className="line-clamp-2 text-[15px] leading-snug text-muted-foreground lg:hidden">{ev.description}</p>}

            {live && (
              <Card className="flex items-center justify-between gap-3 border-primary/30 p-4">
                <div className="flex items-center gap-3">
                  <LivePill />
                  <p className="text-sm text-muted-foreground">Scores are updating now</p>
                </div>
                <Button asChild size="sm">
                  <Link href="/tournament">Watch live</Link>
                </Button>
              </Card>
            )}

            {capacityBlock && <Card className="p-4 lg:hidden">{capacityBlock}</Card>}

            <DetailTabs tabs={tabs} defaultValue={tabs[!isTeamFormat && user ? 1 : 0].value} />
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <Card className="space-y-5 p-5">
                {capacityBlock}
                <RegistrationActions {...registration} variant="card" />
                <ul className="space-y-3 border-t border-border pt-4">
                  {facts.map(f => (
                    <li key={f.text} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <f.icon className="size-4 shrink-0" aria-hidden />
                      {f.text}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border pt-3">
                  <ShareEventButton title={ev.name} url={`/tournaments/${ev.id}`} className="-ml-3" />
                </div>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <RegistrationActions {...registration} variant="bar" />
    </main>
  )
}

function InfoRow({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <li className="flex min-h-11 items-center gap-3 py-2">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span>{children}</span>
    </li>
  )
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
