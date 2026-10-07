'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarX2, ChevronRight, Radio, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchInput } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { LiveDot } from '@/components/ui/live-dot'
import { FadeUpItem, Stagger } from '@/components/motion'
import { searchKey } from '@/lib/search'
import type { DiscoverEvent, LiveTournament } from '@/lib/discover'
import { TournamentCard, TournamentCardCompact } from './tournament-card'

export type DiscoverTab = 'upcoming' | 'live' | 'completed'
type FormatFilter = 'all' | 'americano' | 'teams'

const formats: { value: FormatFilter; label: string }[] = [
  { value: 'all', label: 'All formats' },
  { value: 'americano', label: 'Americano' },
  { value: 'teams', label: 'Teams' },
]

/** Upcoming / Live / Completed tabs, format chips and search over name + location (client-side). */
export function DiscoverBrowser({
  events,
  liveTournament,
  initialTab = 'upcoming',
  heading,
  viewAllHref,
}: {
  events: DiscoverEvent[]
  liveTournament: LiveTournament
  initialTab?: DiscoverTab
  heading?: string
  viewAllHref?: string
}) {
  const [tab, setTab] = useState<DiscoverTab>(initialTab)
  const [format, setFormat] = useState<FormatFilter>('all')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const k = searchKey(q.trim())
    return events.filter(
      ev =>
        (format === 'all' || (format === 'teams') === ev.isTeam) &&
        (!k || searchKey(`${ev.name} ${ev.location ?? ''}`).includes(k))
    )
  }, [events, format, q])

  const byBucket = (b: DiscoverTab) => {
    const list = filtered.filter(e => e.bucket === b)
    // Completed: most recent first.
    return b === 'completed' ? [...list].reverse() : list
  }
  const anyLive = events.some(e => e.bucket === 'live') || !!liveTournament

  const list = (items: DiscoverEvent[], empty: React.ReactNode) =>
    items.length === 0 ? (
      empty
    ) : (
      <>
        {/* Phones: first card large, the rest compact. */}
        <Stagger className="space-y-3 md:hidden">
          {items.map((ev, i) => (
            <FadeUpItem key={ev.id}>{i === 0 ? <TournamentCard ev={ev} /> : <TournamentCardCompact ev={ev} />}</FadeUpItem>
          ))}
        </Stagger>
        <Stagger className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-3 xl:grid-cols-4">
          {items.map(ev => (
            <FadeUpItem key={ev.id} className="h-full">
              <TournamentCard ev={ev} />
            </FadeUpItem>
          ))}
        </Stagger>
      </>
    )

  const filtersActive = format !== 'all' || !!q.trim()
  const clear = filtersActive && (
    <Button
      variant="secondary"
      onClick={() => {
        setFormat('all')
        setQ('')
      }}
    >
      Clear filters
    </Button>
  )

  return (
    <Tabs value={tab} onValueChange={v => setTab(v as DiscoverTab)}>
      <div className="space-y-3 md:flex md:items-center md:gap-3 md:space-y-0">
        <TabsList variant="pill" className="md:w-auto md:min-w-[340px]">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="live" className="gap-2">
            Live {anyLive && <LiveDot className="size-2" />}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" role="group" aria-label="Format">
          {formats.map(f => (
            <button
              key={f.value}
              type="button"
              aria-pressed={format === f.value}
              onClick={() => setFormat(f.value)}
              className={cn(
                'inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                format === f.value
                  ? 'border-foreground bg-foreground text-pitch-950'
                  : 'border-border-strong text-foreground hover:bg-white/5 active:bg-white/10'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search tournaments…"
          aria-label="Search tournaments by name or venue"
          className={cn('md:ml-auto md:w-72', heading && 'max-md:hidden')}
        />
      </div>

      {heading && (
        <div className="mt-7 flex items-baseline justify-between max-md:hidden">
          <h2 className="font-display text-[28px] font-semibold leading-none">
            {tab === 'upcoming' ? heading : tab === 'live' ? 'Live now' : 'Completed'}
          </h2>
          {viewAllHref && (
            <Link href={viewAllHref} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text hover:underline">
              View all <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}

      <TabsContent value="upcoming" className={heading ? 'mt-4 max-md:mt-5' : 'mt-6'}>
        {list(
          byBucket('upcoming'),
          <EmptyState
            icon={CalendarX2}
            title={filtersActive ? 'No matches for these filters' : 'No upcoming tournaments'}
            description={filtersActive ? 'Try another format or search.' : 'New events show up here as soon as they’re announced.'}
            action={clear || undefined}
          />
        )}
      </TabsContent>
      <TabsContent value="live" className={heading ? 'mt-4' : 'mt-6'}>
        <div className="space-y-4">
          {liveTournament && <LiveScoringCard live={liveTournament} />}
          {list(
            byBucket('live'),
            liveTournament ? null : (
              <EmptyState
                icon={Radio}
                title="Nothing live right now"
                description="Live scores appear here while a tournament is being played."
                action={
                  <Button asChild variant="secondary">
                    <Link href="/tournament">Open live scores</Link>
                  </Button>
                }
              />
            )
          )}
        </div>
      </TabsContent>
      <TabsContent value="completed" className={heading ? 'mt-4' : 'mt-6'}>
        {list(
          byBucket('completed'),
          <EmptyState icon={Trophy} title={filtersActive ? 'No matches for these filters' : 'No completed tournaments yet'} action={clear || undefined} />
        )}
      </TabsContent>
    </Tabs>
  )
}

/** The live-scoring tournament isn't linked to an event, so it gets its own card. */
export function LiveScoringCard({ live, className }: { live: NonNullable<LiveTournament>; className?: string }) {
  const round = live.currentRound ? `Round ${live.currentRound}${live.rounds ? ` of ${live.rounds}` : ''}` : null
  return (
    <Link
      href="/tournament"
      className={cn(
        'flex min-h-[72px] items-center gap-4 rounded-2xl border border-primary/30 bg-card p-4 transition-colors hover:border-primary/50 active:bg-pitch-800',
        className
      )}
    >
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <LiveDot />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold leading-tight">Live scoring</p>
        <p className="truncate text-sm text-muted-foreground">{[round, live.players ? `${live.players} players` : null].filter(Boolean).join(' · ') || 'In progress'}</p>
      </div>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-text">
        <LiveDot className="size-2" />
        Live
      </span>
      <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
    </Link>
  )
}
