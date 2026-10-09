import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronRight, ClipboardList, MapPin, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { getLevel } from '@/lib/quiz-questions'
import { formatEventDate } from '@/lib/event-status'
import { loadPlayerEvents, loadPlayerResults, todayString, type PlayerEvent } from '@/lib/player-results'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge, SkillBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { EventThumb } from '@/components/event-thumb'
import { FadeUpItem, Stagger } from '@/components/motion'
import TeamInvitesSection from './team-invites-section'

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  skill_score: number | null
  skill_level: string | null
  quiz_completed_at: string | null
  last_score_change: number | null
}

export const metadata = { title: 'My dashboard · SmashTorino' }

function registrationPill(ev: PlayerEvent) {
  if (!ev.team) return <Badge variant="success" size="md"><span className="size-2 rounded-full bg-success" aria-hidden />Registered · Solo</Badge>
  if (ev.team.status === 'approved') return <Badge variant="success" size="md"><span className="size-2 rounded-full bg-success" aria-hidden />Registered · Team</Badge>
  const text = ev.team.status === 'pending_partner' ? 'Waiting for partner' : 'Waiting for approval'
  return (
    <Badge size="md" className="border-skill-intermediate/50 text-skill-intermediate">
      <span className="size-2 rounded-full bg-skill-intermediate" aria-hidden />
      {text} · Team
    </Badge>
  )
}

function SectionHeader({ title, href, linkLabel = 'View all' }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-[22px] font-semibold">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          {linkLabel}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/signin?redirect=/dashboard')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, skill_score, skill_level, quiz_completed_at, last_score_change, player_code')
    .eq('id', user.id)
    .maybeSingle()
  const profile = profileData as Profile | null

  const score = profile?.skill_score ?? 0
  const quizDone = !!profile?.quiz_completed_at
  const level = quizDone ? getLevel(score) : 'Unranked'

  let rank: number | null = null
  if (quizDone) {
    const { count: higherCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('skill_score', 'is', null)
      .gt('skill_score', score)
    rank = (higherCount ?? 0) + 1
  }

  const events = await loadPlayerEvents(supabase, user.id, true)
  const today = todayString()
  const upcoming = events.filter(e => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))
  const { results } = await loadPlayerResults(supabase, events)

  const firstName = profile?.first_name ?? user.email?.split('@')[0] ?? 'player'
  const myName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || firstName
  const next = upcoming[0]
  const change = profile?.last_score_change ?? 0

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* Decorative court lines (from the mockup), purely visual */}
      <svg aria-hidden className="pointer-events-none absolute -right-24 -top-10 h-72 w-[520px] text-lime/[0.07]" viewBox="0 0 520 288" fill="none">
        <path d="M40 280 L300 20 L520 20" stroke="currentColor" strokeWidth="2" />
        <path d="M140 280 L360 60 L520 60" stroke="currentColor" strokeWidth="2" />
      </svg>

      <div className="relative mx-auto max-w-[1100px] px-4 pb-10 pt-6 md:px-8 md:pt-10">
        <header>
          <h1 className="font-display text-[38px] font-bold leading-none md:text-hero-lg">Hey, {firstName}</h1>
          <p className="mt-1 text-[17px] text-foreground/80">Ready for your next match?</p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
          <div className="min-w-0">
          {/* Renders nothing when there are no pending invites. */}
          <TeamInvitesSection userId={user.id} me={{ name: myName, avatarUrl: profile?.avatar_url ?? null }} />
          <Stagger className="space-y-4">

            {/* Upcoming */}
            <FadeUpItem>
              <Card className="p-4 md:p-5">
                <SectionHeader title={upcoming.length > 1 ? 'Your upcoming events' : 'Your upcoming event'} href="/tournaments" />
                {!next ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="Nothing booked yet"
                    description="Find a tournament and grab a spot."
                    action={
                      <Button asChild>
                        <Link href="/">Discover tournaments</Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="space-y-2">
                    {upcoming.map((ev, i) => (
                      <li key={ev.id}>
                        <Link
                          href={`/tournaments/${ev.id}`}
                          className="flex items-center gap-3 rounded-xl border border-border bg-pitch-850 p-2.5 transition-colors active:bg-pitch-800"
                        >
                          <EventThumb imageUrl={ev.image_url} className={i === 0 ? 'size-24' : 'size-16'} badge={i === 0 ? 'size-7' : 'size-5'} />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className={cn('truncate font-display font-semibold leading-tight', i === 0 ? 'text-[22px]' : 'text-lg')}>{ev.name}</p>
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <CalendarDays className="size-4 shrink-0" aria-hidden />
                              <span className="truncate">{[formatEventDate(ev.date, 'short'), ev.time].filter(Boolean).join(' · ')}</span>
                            </p>
                            {ev.location && (
                              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <MapPin className="size-4 shrink-0" aria-hidden />
                                <span className="truncate">{ev.location}</span>
                              </p>
                            )}
                            <div className="pt-0.5">{registrationPill(ev)}</div>
                          </div>
                          <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </FadeUpItem>

            {/* Recent results */}
            <FadeUpItem>
              <Card className="p-4 md:p-5">
                <SectionHeader title="Recent results" href={results.length > 3 ? '/profile' : undefined} />
                {results.length === 0 ? (
                  <EmptyState icon={Trophy} title="No results yet" description="Your tournaments show up here once they’re played." />
                ) : (
                  <ul className="space-y-2">
                    {results.slice(0, 3).map(r => (
                      <li key={r.id}>
                        <Link
                          href={`/tournaments/${r.id}`}
                          className="flex min-h-[72px] items-center gap-3 rounded-xl border border-border bg-pitch-850 p-2.5 transition-colors active:bg-pitch-800"
                        >
                          <EventThumb imageUrl={r.image_url} className="size-14" badge="size-5" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-lg font-semibold leading-tight">
                              {r.name}
                              <span className="font-sans text-sm font-normal text-muted-foreground"> · {r.format ?? 'Americano'}</span>
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {[r.location, formatEventDate(r.date, 'short')].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          {r.placement && (
                            <span
                              className={cn(
                                'shrink-0 text-right font-display text-lg font-semibold leading-tight',
                                r.placement.rank === 1 ? 'text-medal-gold' : r.placement.rank === 2 ? 'text-medal-silver' : r.placement.rank === 3 ? 'text-medal-bronze' : 'text-foreground'
                              )}
                            >
                              {r.placement.label}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </FadeUpItem>
          </Stagger>
          </div>

          {/* Rating */}
          <Stagger className="space-y-4">
            <FadeUpItem>
              <Link href="/profile" className="block rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-border-strong active:bg-pitch-800 md:p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-[22px] font-semibold">Your rating</h2>
                  <ChevronRight className="size-5 text-subtle" aria-hidden />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="font-display text-[38px] font-bold leading-none tabular">{quizDone ? score : '—'}</p>
                  <SkillBadge level={level} variant="solid" size="md" dot />
                </div>
                {(rank !== null || change !== 0) && (
                  <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                    {rank !== null && <span>Rank #{rank} in Turin</span>}
                    {change !== 0 && (
                      <span className={change > 0 ? 'text-success' : 'text-destructive'}>
                        {change > 0 ? `+${change}` : change} last change
                      </span>
                    )}
                  </p>
                )}
              </Link>
            </FadeUpItem>
            {!quizDone && (
              <FadeUpItem>
                <Link
                  href="/quiz"
                  className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-card transition-colors active:bg-pitch-800"
                >
                  <ClipboardList className="size-6 shrink-0 text-primary-text" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-semibold leading-tight">Get your skill level</p>
                    <p className="text-sm text-muted-foreground">16 questions, about 3 minutes</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
                </Link>
              </FadeUpItem>
            )}
          </Stagger>
        </div>
      </div>
    </main>
  )
}
