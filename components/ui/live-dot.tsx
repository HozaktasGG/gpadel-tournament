import { cn } from '@/lib/utils'

/** Pulsing LIVE indicator. The ring animation is disabled under reduced motion. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('relative inline-flex size-2.5 shrink-0', className)}>
      <span className="absolute inset-0 rounded-full bg-live motion-safe:animate-live-pulse" />
      <span className="relative size-full rounded-full bg-live" />
    </span>
  )
}
