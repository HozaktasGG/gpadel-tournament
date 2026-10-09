'use client'

import { motion } from 'motion/react'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE_OUT } from '@/components/motion'

/**
 * "16 / 20 spots" + fill bar + "80% full" / "4 spots left".
 * Team events pass unit="teams" with team counts (not players).
 */
export function CapacityBar({
  filled,
  capacity,
  unit = 'spots',
  tone = 'lime',
  layout = 'compact',
  className,
}: {
  filled: number
  capacity: number | null | undefined
  unit?: 'spots' | 'teams'
  tone?: 'lime' | 'primary'
  layout?: 'compact' | 'detailed'
  className?: string
}) {
  const cap = capacity && capacity > 0 ? capacity : null
  const pct = cap ? Math.min(100, Math.round((filled / cap) * 100)) : 0
  const left = cap ? Math.max(0, cap - filled) : null
  const full = cap !== null && left === 0
  const leftLabel = full ? 'Full' : `${left} ${unit === 'teams' ? (left === 1 ? 'team' : 'teams') : left === 1 ? 'spot' : 'spots'} left`

  const bar = (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.12]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={cap ?? 0}
      aria-valuenow={filled}
      aria-label={`${filled} of ${cap ?? '—'} ${unit} taken`}
    >
      <motion.div
        className={cn('h-full rounded-full', tone === 'lime' ? 'bg-lime' : 'bg-primary')}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
      />
    </div>
  )

  if (layout === 'detailed') {
    return (
      <div className={cn('space-y-2.5', className)}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-center font-display text-xl font-semibold tabular">
            <Users className="mr-2 size-5 text-muted-foreground" aria-hidden />
            <span>
              {filled} <span className="text-muted-foreground">/ {cap ?? '—'}</span> <span className="text-base font-medium">{unit}</span>
            </span>
          </p>
          {cap !== null && <p className={cn('text-sm', full ? 'text-primary-text' : 'text-muted-foreground')}>{leftLabel}</p>}
        </div>
        {bar}
        {cap !== null && <p className="text-right text-xs text-muted-foreground tabular">{pct}% full</p>}
      </div>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-right text-sm text-foreground tabular">
        {filled} / {cap ?? '—'} {unit}
      </p>
      {bar}
      {cap !== null && <p className="text-right text-[11px] text-subtle tabular">{full ? 'Full' : `${pct}%`}</p>}
    </div>
  )
}
