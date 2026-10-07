import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-xl bg-white/[0.06]',
        'after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/[0.06] after:to-transparent motion-safe:after:animate-shimmer',
        className
      )}
      {...props}
    />
  )
}

/** Card-shaped placeholder used while tournament lists load. */
export function TournamentCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-3" role="status" aria-label="Loading">
      <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-11 w-full" />
    </div>
  )
}

export function PlayerRowSkeleton() {
  return (
    <div className="flex h-[60px] items-center gap-3 rounded-xl border border-border bg-card px-3" role="status" aria-label="Loading">
      <Skeleton className="size-11 rounded-full" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
}
