import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { isTeamFormat } from '@/lib/event-format'
import { LiveDot } from '@/components/ui/live-dot'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none',
  {
    variants: {
      variant: {
        neutral: 'border border-border-strong text-foreground',
        muted: 'bg-white/5 text-muted-foreground',
        featured: 'bg-primary text-primary-foreground uppercase tracking-[0.08em]',
        americano: 'bg-format-americano text-white uppercase tracking-[0.06em]',
        team: 'bg-format-team text-white uppercase tracking-[0.06em]',
        success: 'bg-success/15 text-success',
        live: 'border border-primary/40 bg-primary/10 text-primary-text uppercase tracking-[0.08em]',
      },
      size: {
        sm: 'h-6 px-2.5 text-[11px]',
        md: 'h-7 px-3 text-xs',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

// ---------------------------------------------------------------------------
// Skill level

export type SkillLevel = 'Unranked' | 'Beginner' | 'Intermediate' | 'Advanced'

export function normalizeSkill(level: string | null | undefined): SkillLevel {
  return level === 'Beginner' || level === 'Intermediate' || level === 'Advanced' ? level : 'Unranked'
}

const skillOutline: Record<SkillLevel, string> = {
  Unranked: 'border-skill-unranked/50 bg-skill-unranked-bg text-skill-unranked',
  Beginner: 'border-skill-beginner/70 bg-skill-beginner/10 text-skill-beginner',
  Intermediate: 'border-skill-intermediate/70 bg-skill-intermediate/10 text-skill-intermediate',
  Advanced: 'border-skill-advanced/70 bg-skill-advanced/10 text-skill-advanced',
}
const skillSolid: Record<SkillLevel, string> = {
  Unranked: 'border-skill-unranked/40 bg-skill-unranked-bg text-skill-unranked',
  Beginner: 'border-transparent bg-skill-beginner text-skill-ink',
  Intermediate: 'border-transparent bg-skill-intermediate text-skill-ink',
  Advanced: 'border-transparent bg-skill-advanced text-skill-ink',
}

/** Outline = lists/tables; solid = profile header + legend. */
function SkillBadge({
  level,
  variant = 'outline',
  size = 'sm',
  dot = false,
  className,
}: {
  level: string | null | undefined
  variant?: 'outline' | 'solid'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}) {
  const l = normalizeSkill(level)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold leading-none',
        size === 'sm' ? 'h-6 px-2.5 text-[11px]' : 'h-8 px-3.5 text-sm',
        variant === 'solid' ? skillSolid[l] : skillOutline[l],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn('size-2.5 rounded-full', variant === 'solid' && l !== 'Unranked' ? 'bg-skill-ink' : 'bg-current')}
        />
      )}
      {l}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Format / featured / live

function formatLabel(format: string | null | undefined) {
  if (format === 'Team') return 'Team tournament'
  if (format === 'Team Americano') return 'Team Americano'
  return 'Americano'
}

function FormatBadge({ format, size = 'sm', className }: { format: string | null | undefined; size?: 'sm' | 'md'; className?: string }) {
  return (
    <Badge variant={isTeamFormat(format) ? 'team' : 'americano'} size={size} className={className}>
      {formatLabel(format)}
    </Badge>
  )
}

function FeaturedTag({ className }: { className?: string }) {
  return (
    <Badge variant="featured" size="sm" className={className}>
      Featured
    </Badge>
  )
}

function LivePill({ className, label = 'Live' }: { className?: string; label?: string }) {
  return (
    <Badge variant="live" size="md" className={className}>
      <LiveDot />
      {label}
    </Badge>
  )
}

export { Badge, badgeVariants, SkillBadge, FormatBadge, FeaturedTag, LivePill, formatLabel }
