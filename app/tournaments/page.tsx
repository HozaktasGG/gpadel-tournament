import { loadDiscover } from '@/lib/discover'
import { DiscoverBrowser, type DiscoverTab } from '@/components/discover/discover-browser'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Tournaments · SmashTorino' }

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  // `?tab=past` is the old link format for completed events.
  const initialTab: DiscoverTab =
    params.tab === 'live' ? 'live' : params.tab === 'completed' || params.tab === 'past' ? 'completed' : 'upcoming'
  const { events, liveTournament } = await loadDiscover()

  return (
    <main className="flex-1 pb-10">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 md:px-8 md:pt-10">
        <p className="text-overline font-semibold uppercase text-muted-foreground">Turin padel community</p>
        <h1 className="mb-5 mt-1 font-display text-[36px] font-bold leading-none md:text-hero-lg">Tournaments</h1>
        <DiscoverBrowser events={events} liveTournament={liveTournament} initialTab={initialTab} />
      </div>
    </main>
  )
}
