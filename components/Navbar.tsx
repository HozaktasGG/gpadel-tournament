'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Profile = {
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
  is_admin: boolean | null
  player_code: string | null
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/about', label: 'About' },
]

export default function Navbar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [hasLiveTournament, setHasLiveTournament] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('first_name, last_name, email, avatar_url, is_admin, player_code')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null))
  }, [userId, supabase])

  useEffect(() => {
    setMobileOpen(false)
    setDropdownOpen(false)
  }, [pathname])

  useEffect(() => {
    let cancelled = false
    const checkLive = async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      if (!cancelled) setHasLiveTournament(!!data)
    }
    checkLive()
    const channel = supabase
      .channel('navbar-live-check')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => checkLive()
      )
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setDropdownOpen(false)
    setMobileOpen(false)
    router.push('/')
    router.refresh()
  }

  const initial = (profile?.first_name?.[0] ?? profile?.email?.[0] ?? '?').toUpperCase()
  const displayName = profile?.first_name ?? profile?.email ?? 'Account'
  const isAdmin = !!profile?.is_admin
  const avatarUrl = profile?.avatar_url ?? null

  const AvatarCircle = ({ size = 32 }: { size?: number }) =>
    avatarUrl ? (
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    ) : (
      <span
        className="rounded-full flex items-center justify-center font-bold text-white"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
          backgroundColor: '#ff6b35',
        }}
      >
        {initial}
      </span>
    )

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur"
      style={{
        backgroundColor: 'rgba(26,61,46,0.85)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <img
            src="/smashpadel_logo.png"
            alt="SmashTorino"
            width={36}
            height={36}
            className="rounded-full"
          />
          <span className="font-bold text-white tracking-tight text-base sm:text-lg">
            SmashTorino
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map(link => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors"
                style={{
                  color: active ? '#ff6b35' : 'rgba(255,255,255,0.85)',
                }}
              >
                {link.label}
              </Link>
            )
          })}
          {hasLiveTournament && (
            <Link
              href="/tournament"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{
                backgroundColor: 'rgba(239,68,68,0.18)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.4)',
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: '#ef4444', animation: 'pulse 1.5s infinite' }}
              />
              Live
            </Link>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {userId ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-full transition"
                style={{
                  backgroundColor: dropdownOpen
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(255,255,255,0.05)',
                }}
              >
                <AvatarCircle size={32} />
                <span className="text-sm font-medium text-white max-w-[120px] truncate">
                  {displayName}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  style={{
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s',
                  }}
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden shadow-2xl"
                  style={{
                    backgroundColor: '#0f2a1f',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2.5 text-sm text-white hover:bg-white/5"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className="block px-4 py-2.5 text-sm text-white hover:bg-white/5"
                  >
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block px-4 py-2.5 text-sm font-semibold hover:bg-white/5"
                      style={{ color: '#ff6b35' }}
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={signOut}
                    className="block w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/5"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/signin"
                className="text-sm font-semibold text-white px-4 py-2 rounded-full hover:bg-white/5 transition"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-sm font-bold text-white px-4 py-2 rounded-full transition hover:brightness-110"
                style={{ backgroundColor: '#ff6b35' }}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(v => !v)}
          className="md:hidden p-2 rounded-md"
          aria-label="Toggle menu"
        >
          <div className="w-5 h-4 relative flex flex-col justify-between">
            <span
              className="block h-0.5 w-full bg-white rounded"
              style={{
                transform: mobileOpen ? 'translateY(7px) rotate(45deg)' : 'none',
                transition: 'all 0.2s',
              }}
            />
            <span
              className="block h-0.5 w-full bg-white rounded"
              style={{
                opacity: mobileOpen ? 0 : 1,
                transition: 'opacity 0.2s',
              }}
            />
            <span
              className="block h-0.5 w-full bg-white rounded"
              style={{
                transform: mobileOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
                transition: 'all 0.2s',
              }}
            />
          </div>
        </button>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden"
          style={{
            backgroundColor: '#0f2a1f',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="px-4 py-4 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-white"
                style={{
                  backgroundColor:
                    pathname === link.href
                      ? 'rgba(255,107,53,0.15)'
                      : 'transparent',
                  color: pathname === link.href ? '#ff6b35' : 'white',
                }}
              >
                {link.label}
              </Link>
            ))}
            {hasLiveTournament && (
              <Link
                href="/tournament"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.18)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.4)',
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#ef4444', animation: 'pulse 1.5s infinite' }}
                />
                Live Tournament
              </Link>
            )}
            <div
              className="pt-3 mt-3 space-y-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              {userId ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <AvatarCircle size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        {profile?.email}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard"
                    className="block px-3 py-2.5 rounded-lg text-sm text-white hover:bg-white/5"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className="block px-3 py-2.5 rounded-lg text-sm text-white hover:bg-white/5"
                  >
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/5"
                      style={{ color: '#ff6b35' }}
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={signOut}
                    className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-white hover:bg-white/5"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signin"
                    className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="block px-3 py-2.5 rounded-lg text-sm font-bold text-white text-center"
                    style={{ backgroundColor: '#ff6b35' }}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
