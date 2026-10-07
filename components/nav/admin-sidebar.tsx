'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, Home, Network, ScanLine, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from './site-header'

// Only sections that exist today. "Events"/"Players" are sections of /admin.
const items = [
  { href: '/admin', label: 'Overview', icon: Home, key: 'overview' },
  { href: '/admin#events', label: 'Events', icon: CalendarDays, key: 'events' },
  { href: '/admin#players', label: 'Players', icon: Users, key: 'players' },
  { href: '/admin/tournament', label: 'Fixtures', icon: Network, key: 'fixtures' },
  { href: '/admin/scan', label: 'Check-in', icon: ScanLine, key: 'scan' },
]

function activeKey(pathname: string, hash: string) {
  if (pathname.startsWith('/admin/events')) return 'events'
  if (pathname.startsWith('/admin/tournament')) return 'fixtures'
  if (pathname.startsWith('/admin/scan')) return 'scan'
  if (hash === '#events') return 'events'
  if (hash === '#players') return 'players'
  return 'overview'
}

/** Desktop-only (lg+) organizer sidebar. */
export function AdminSidebar() {
  const pathname = usePathname() ?? '/admin'
  const [hash, setHash] = useState('')
  useEffect(() => {
    const update = () => setHash(window.location.hash)
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [pathname])
  const current = activeKey(pathname, hash)

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-pitch-950 lg:flex">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-1 px-3">
        {items.map(({ href, label, icon: Icon, key }) => {
          const active = current === key
          return (
            <Link
              key={key}
              href={href}
              onClick={() => setHash(href.includes('#') ? href.slice(href.indexOf('#')) : '')}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                active ? 'bg-pitch-700 text-foreground' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                active && 'before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary'
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="relative mx-3 mb-3 overflow-hidden rounded-2xl">
        <img src="/hero-bg.jpg" alt="" className="h-40 w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/40 to-transparent" />
        <p className="absolute inset-x-4 bottom-3 font-display text-sm font-semibold uppercase leading-snug tracking-[0.14em]">
          A stronger padel community in Turin
        </p>
      </div>
      <Link
        href="/"
        className="mx-3 mb-4 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to site
      </Link>
    </aside>
  )
}
