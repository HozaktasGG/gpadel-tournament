'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LayoutDashboard, LogOut, Shield, Trophy, User, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LiveDot } from '@/components/ui/live-dot'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSessionProfile } from './session-context'
import { hidesMobileChrome, isActive } from './nav-config'

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex min-h-11 shrink-0 items-center gap-2.5', className)} aria-label="SmashTorino home">
      <img src="/smashpadel_logo.png" alt="" width={36} height={36} className="size-9 rounded-full" />
      <span className="font-display text-[22px] font-bold tracking-tight text-foreground">SmashTorino</span>
    </Link>
  )
}

const desktopLinks = [
  { href: '/tournaments', label: 'Tournaments', match: ['/tournaments'] },
  { href: '/tournament', label: 'Live scores', match: ['/tournament'] },
  { href: '/dashboard', label: 'My dashboard', match: ['/dashboard'] },
]

export function SiteHeader() {
  const pathname = usePathname() ?? '/'
  const { userId, authReady, profile, displayName, isAdmin, hasLiveTournament, signOut } = useSessionProfile()
  const inAdmin = pathname.startsWith('/admin')

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-pitch-900/85 pt-safe backdrop-blur-md supports-[backdrop-filter]:bg-pitch-900/70',
        // The admin workspace has its own sidebar on desktop.
        inAdmin && 'lg:hidden',
        hidesMobileChrome(pathname) && 'max-md:hidden'
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:h-[72px] md:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden h-full items-stretch gap-8 md:flex">
          {desktopLinks.map(link => {
            const active = isActive(pathname, link.match)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex items-center gap-2 text-[15px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  'after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary after:transition-opacity',
                  active ? 'after:opacity-100' : 'after:opacity-0'
                )}
              >
                {link.label}
                {link.href === '/tournament' && hasLiveTournament && <LiveDot />}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {!authReady ? (
            <span className="size-11" aria-hidden />
          ) : userId ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-white/5 data-[state=open]:bg-white/[0.07] md:inline-flex"
                aria-label="Account menu"
              >
                <Avatar src={profile?.avatar_url} name={displayName} size="sm" />
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <p className="truncate font-semibold">{displayName}</p>
                  {profile?.player_code && <p className="text-xs text-muted-foreground">{profile.player_code}</p>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard"><LayoutDashboard />My dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile"><User />Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/leaderboard"><Trophy />Leaderboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/about"><Info />About</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="text-primary-text"><Shield className="!text-primary-text" />Admin</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}><LogOut />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/signin">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
          {/* Phones: admins get a shortcut since the account menu lives in Profile. */}
          {userId && isAdmin && (
            <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Admin">
              <Link href="/admin"><Shield /></Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
