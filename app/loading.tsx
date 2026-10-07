import { Skeleton, TournamentCardSkeleton } from '@/components/ui/skeleton'

/** Generic route skeleton (server navigations). */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-10 pt-6 md:px-8 md:pt-10" aria-busy="true">
      <p className="sr-only">Loading…</p>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-11 w-3/4 max-w-md" />
      <Skeleton className="mt-6 h-12 w-full max-w-md rounded-full" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <TournamentCardSkeleton key={i} />
        ))}
      </div>
    </main>
  )
}
