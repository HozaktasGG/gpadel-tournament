import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { SkillBadge } from '@/components/ui/badge'

/** 1–3 as gold/silver/bronze medals, otherwise a plain number. */
export function RankMedal({ rank, className }: { rank: number; className?: string }) {
  const medal =
    rank === 1 ? 'bg-medal-gold' : rank === 2 ? 'bg-medal-silver' : rank === 3 ? 'bg-medal-bronze' : null
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold tabular',
        medal ? cn(medal, 'text-skill-ink') : 'text-muted-foreground',
        className
      )}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  )
}

export type PlayerRowProps = {
  rank?: number
  name: string
  avatarUrl?: string | null
  skillLevel?: string | null
  rating?: number | null
  /** Secondary line, e.g. player code. */
  meta?: React.ReactNode
  href?: string
  trailing?: React.ReactNode
  className?: string
}

export function PlayerRow({ rank, name, avatarUrl, skillLevel, rating, meta, href, trailing, className }: PlayerRowProps) {
  const body = (
    <>
      {rank !== undefined && <RankMedal rank={rank} />}
      <Avatar src={avatarUrl} name={name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[17px] font-semibold leading-tight">{name}</p>
        {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
      </div>
      {skillLevel !== undefined && <SkillBadge level={skillLevel} />}
      {rating !== undefined && (
        <span className="w-12 text-right font-display text-lg font-semibold tabular">{rating ?? '—'}</span>
      )}
      {trailing}
      {href && <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle" />}
    </>
  )
  const cls = cn(
    'flex min-h-[60px] items-center gap-3 rounded-xl border border-border bg-pitch-850 px-3 py-2',
    href && 'transition-colors hover:bg-pitch-800 active:bg-pitch-700',
    className
  )
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
