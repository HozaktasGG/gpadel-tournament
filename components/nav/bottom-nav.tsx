'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, CalendarDays, Search, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LiveDot } from '@/components/ui/live-dot'
import { HIDE_BOTTOM_NAV, isActive } from './nav-config'
import { useSessionProfile } from './session-context'

const items = [
  { href: '/', label: 'Discover', icon: Search, match: ['/', '/tournaments'] },
  { href: '/dashboard', label: 'My events', icon: CalendarDays, match: ['/dashboard', '/team-invite'] },
  { href: '/tournament', label: 'Scores', icon: BarChart3, match: ['/tournament', '/leaderboard'] },
  { href: '/profile', label: 'Profile', icon: User, match: ['/profile', '/quiz'] },
]

/** Phone tab bar. Sits above the home indicator via safe-area padding. */
export function BottomNav() {
  const pathname = usePathname() ?? '/'
  const { hasLiveTournament } = useSessionProfile()
  if (isActive(pathname, HIDE_BOTTOM_NAV)) return null

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-pitch-950/90 pb-safe backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid h-[var(--bottom-nav-h)] max-w-md grid-cols-4">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(pathname, match)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:bg-white/5',
                  active ? 'text-primary-text' : 'text-muted-foreground'
                )}
              >
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  {href === '/tournament' && hasLiveTournament && <LiveDot className="absolute -right-1.5 -top-0.5 size-2" />}
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Spacer so page content and footers clear the fixed bottom nav on phones. */
export function BottomNavSpacer() {
  const pathname = usePathname() ?? '/'
  if (isActive(pathname, HIDE_BOTTOM_NAV)) return null
  return <div aria-hidden className="h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] shrink-0 md:hidden" />
}
