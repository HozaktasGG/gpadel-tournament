import { PlayerRowSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="flex-1 pb-10" aria-busy="true">
      <p className="sr-only">Loading tournament…</p>
      <div className="md:mx-auto md:mt-6 md:max-w-[1200px] md:px-8">
        <Skeleton className="h-[340px] w-full rounded-none md:h-[300px] md:rounded-3xl" />
      </div>
      <div className="mx-auto max-w-[1200px] space-y-4 px-4 pt-4 md:px-8 md:pt-6">
        <Skeleton className="h-40 w-full rounded-2xl lg:w-2/3" />
        <Skeleton className="h-24 w-full rounded-2xl lg:w-2/3" />
        <div className="space-y-2 lg:w-2/3">
          {Array.from({ length: 4 }).map((_, i) => (
            <PlayerRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  )
}
