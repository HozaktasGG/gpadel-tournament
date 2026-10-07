import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { SkillBadge } from '@/components/ui/badge'

export type PairPlayer = {
  name: string
  avatarUrl?: string | null
  skillLevel?: string | null
  rating?: number | null
}

function PairMember({ p }: { p: PairPlayer }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar src={p.avatarUrl} name={p.name} size="lg" />
      <div className="min-w-0 space-y-1">
        <p className="truncate font-display text-base font-semibold leading-tight">{p.name}</p>
        {p.skillLevel !== undefined && <SkillBadge level={p.skillLevel} />}
        {p.rating !== undefined && <p className="font-display text-base font-semibold tabular">{p.rating ?? '—'}</p>}
      </div>
    </div>
  )
}

/** Two-player team card. `partner` null = pending partner. */
export function TeamPairCard({
  teamName,
  captain,
  partner,
  footer,
  className,
}: {
  teamName?: string | null
  captain: PairPlayer
  partner: PairPlayer | null
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 shadow-card', className)}>
      {teamName && <p className="mb-3 font-display text-lg font-semibold">{teamName}</p>}
      <div className="grid grid-cols-2 gap-3">
        <PairMember p={captain} />
        {partner ? (
          <PairMember p={partner} />
        ) : (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-border-strong">?</span>
            Waiting for partner
          </div>
        )}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  )
}
