import Link from 'next/link'
import { BarChart3, ChevronRight } from 'lucide-react'
import { loadDiscover } from '@/lib/discover'
import { HomeHero } from '@/components/discover/home-hero'
import { DiscoverBrowser, LiveScoringCard } from '@/components/discover/discover-browser'
import { whenLabel } from '@/components/discover/tournament-card'
import { LivePill } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { events, liveTournament } = await loadDiscover()
  const liveEvents = events.filter(e => e.bucket === 'live')
  const lastCompleted = [...events].reverse().find(e => e.bucket === 'completed')

  return (
    <main className="flex-1 pb-10">
      <HomeHero />

      <div className="mx-auto max-w-[1200px] px-4 pt-5 md:px-8 md:pt-8">
        <DiscoverBrowser events={events} liveTournament={liveTournament} heading="Upcoming tournaments" viewAllHref="/tournaments" />

        {(liveEvents.length > 0 || liveTournament || lastCompleted) && (
          <div className={`mt-10 grid grid-cols-1 gap-4 ${(liveEvents.length > 0 || liveTournament) && lastCompleted ? 'lg:grid-cols-2' : ''}`}>
            {(liveEvents.length > 0 || liveTournament) && (
              <Card className="p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2.5 font-display text-2xl font-semibold">
                    <span className="size-2.5 rounded-full bg-live motion-safe:animate-pulse" aria-hidden />
                    Live now
                  </h2>
                  <Link href="/tournament" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text hover:underline">
                    Live scores <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </div>
                <div className="space-y-2">
                  {liveEvents.map(ev => (
                    <Link
                      key={ev.id}
                      href={`/tournaments/${ev.id}`}
                      className="flex min-h-[64px] items-center gap-3 rounded-xl border border-border bg-pitch-850 p-3 transition-colors active:bg-pitch-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-semibold leading-tight">{ev.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{[ev.subtitle, ev.location].filter(Boolean).join(' · ')}</p>
                      </div>
                      <LivePill />
                      <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
                    </Link>
                  ))}
                  {liveTournament && <LiveScoringCard live={liveTournament} className="bg-pitch-850" />}
                </div>
              </Card>
            )}

            {lastCompleted && (
              <Card className="p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-2xl font-semibold">Completed</h2>
                  <Link href="/tournaments?tab=completed" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text hover:underline">
                    View all results <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </div>
                <Link
                  href={`/tournaments/${lastCompleted.id}`}
                  className="flex min-h-[72px] items-center gap-3 rounded-xl border border-border bg-pitch-850 p-3 transition-colors active:bg-pitch-800"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                    <img src="/hero-bg.jpg" alt="" className="size-full object-cover" />
                    {lastCompleted.imageUrl && (
                      <img src={lastCompleted.imageUrl} alt="" className="absolute bottom-1 right-1 size-6 rounded-full border border-white/80 bg-white object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold leading-tight">{lastCompleted.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {lastCompleted.subtitle} · {whenLabel({ date: lastCompleted.date, time: null })}
                    </p>
                  </div>
                  <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border-strong px-3 text-sm font-medium">
                    <BarChart3 className="size-4" aria-hidden />
                    <span className="max-sm:sr-only">View results</span>
                  </span>
                </Link>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
