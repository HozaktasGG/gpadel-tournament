import Link from 'next/link'
import { BarChart3, CalendarDays, ChevronRight, MapPin, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge, FeaturedTag, LivePill } from '@/components/ui/badge'
import { CapacityBar } from '@/components/ui/capacity-bar'
import { formatEventDate, formatPrice } from '@/lib/event-status'
import type { DiscoverEvent } from '@/lib/discover'

const formatChip = (ev: DiscoverEvent) => (ev.isTeam ? 'Teams' : 'Americano')

export function whenLabel(ev: Pick<DiscoverEvent, 'date' | 'time'>) {
  return [formatEventDate(ev.date, 'short'), ev.time].filter(Boolean).join(' · ')
}

/** Court photo + optional organizer logo badge (logos are never cropped as covers). */
function Cover({ ev, className, logoSize = 'size-10' }: { ev: DiscoverEvent; className?: string; logoSize?: string }) {
  return (
    <div className={cn('relative overflow-hidden bg-pitch-800', className)}>
      <img src="/hero-bg.jpg" alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-pitch-850 via-pitch-850/20 to-transparent" />
      {ev.imageUrl && (
        <img
          src={ev.imageUrl}
          alt=""
          loading="lazy"
          className={cn('absolute right-2.5 top-2.5 rounded-full border-2 border-white/80 bg-white object-contain shadow-elevated', logoSize)}
        />
      )}
    </div>
  )
}

function Meta({ ev, dense = false }: { ev: DiscoverEvent; dense?: boolean }) {
  const price = formatPrice(ev.entryFee)
  const row = cn('flex items-center gap-2 text-muted-foreground', dense ? 'text-[13px]' : 'text-sm')
  const icon = cn('shrink-0', dense ? 'size-3.5' : 'size-4')
  return (
    <ul className={cn(dense ? 'space-y-0.5' : 'space-y-1')}>
      <li className={row}>
        <CalendarDays className={icon} aria-hidden />
        <span className="truncate text-foreground/90">{whenLabel(ev)}</span>
      </li>
      {ev.location && (
        <li className={row}>
          <MapPin className={icon} aria-hidden />
          <span className="truncate">{ev.location}</span>
        </li>
      )}
      {price && (
        <li className={row}>
          <Tag className={icon} aria-hidden />
          <span>{price === 'Free' ? 'Free entry' : `${price} / person`}</span>
        </li>
      )}
    </ul>
  )
}

/** Large card: grid on desktop, first card on phones. Whole card is the link. */
export function TournamentCard({ ev, className }: { ev: DiscoverEvent; className?: string }) {
  const completed = ev.bucket === 'completed'
  return (
    <Link
      href={`/tournaments/${ev.id}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-border-strong active:bg-pitch-800',
        className
      )}
    >
      <div className="relative">
        <Cover ev={ev} className="aspect-[2/1] md:aspect-[16/9]" logoSize="size-11" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {ev.featured && <FeaturedTag />}
          {ev.bucket === 'live' && <LivePill />}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 pt-1">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-display text-[22px] font-semibold leading-tight">{ev.name}</h3>
          <p className="truncate text-sm text-muted-foreground">{ev.subtitle}</p>
        </div>
        <Meta ev={ev} />
        <div className="mt-auto flex items-end gap-3 pt-1">
          <Badge size="sm" className="mb-1 shrink-0">{formatChip(ev)}</Badge>
          {!completed && <CapacityBar className="flex-1" filled={ev.filled} capacity={ev.capacity} unit={ev.isTeam ? 'teams' : 'spots'} />}
        </div>
        <span
          className={cn(
            'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl font-display text-base font-semibold transition-colors',
            completed
              ? 'border border-border-strong text-foreground group-hover:bg-white/5'
              : 'bg-primary text-primary-foreground shadow-cta group-hover:bg-primary-hover group-active:bg-primary-pressed'
          )}
        >
          {completed ? (
            <>
              <BarChart3 className="size-4" aria-hidden />
              View results
            </>
          ) : (
            <>
              View tournament
              <ChevronRight className="size-4" aria-hidden />
            </>
          )}
        </span>
      </div>
    </Link>
  )
}

/** Compact row card used after the first card on phones. */
export function TournamentCardCompact({ ev, className }: { ev: DiscoverEvent; className?: string }) {
  return (
    <Link
      href={`/tournaments/${ev.id}`}
      className={cn('flex gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-card transition-colors active:bg-pitch-800', className)}
    >
      <div className="relative w-[104px] shrink-0">
        <Cover ev={ev} className="h-full min-h-[120px] rounded-xl" logoSize="size-8" />
        {ev.featured && <FeaturedTag className="absolute bottom-2 left-2 h-5 px-1.5 text-[9px]" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5 pr-1">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold leading-tight">{ev.name}</h3>
          <p className="truncate text-[13px] text-muted-foreground">{ev.subtitle}</p>
        </div>
        <Meta ev={ev} dense />
        <div className="mt-auto flex items-end gap-2">
          <Badge size="sm" className="mb-1 shrink-0">{formatChip(ev)}</Badge>
          {ev.bucket !== 'completed' && (
            <CapacityBar className="flex-1" filled={ev.filled} capacity={ev.capacity} unit={ev.isTeam ? 'teams' : 'spots'} />
          )}
          {ev.bucket === 'live' && <LivePill className="mb-1" />}
        </div>
      </div>
    </Link>
  )
}
