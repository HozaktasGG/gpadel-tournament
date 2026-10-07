'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export type NavProfile = {
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  is_admin: boolean | null
  player_code: string | null
}

/** Auth state, the signed-in profile and whether the live tournament is active (same queries as the old Navbar). */
function useSessionState() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  // Own email comes from the auth session (profiles.email is not readable via the public API).
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<NavProfile | null>(null)
  const [hasLiveTournament, setHasLiveTournament] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
      setUserEmail(data.user?.email ?? null)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null)
      setUserEmail(session?.user?.email ?? null)
      setAuthReady(true)
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
      .select('first_name, last_name, avatar_url, is_admin, player_code')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setProfile(data as NavProfile | null))
  }, [userId, supabase])

  useEffect(() => {
    let cancelled = false
    const checkLive = async () => {
      const { data } = await supabase.from('tournaments').select('id').eq('status', 'active').limit(1).maybeSingle()
      if (!cancelled) setHasLiveTournament(!!data)
    }
    checkLive()
    const channel = supabase
      .channel('nav-live-check')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => checkLive())
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || userEmail || 'Account'

  return { userId, authReady, profile, displayName, isAdmin: !!profile?.is_admin, hasLiveTournament, signOut }
}

type SessionValue = ReturnType<typeof useSessionState>
const SessionContext = createContext<SessionValue | null>(null)

/** One auth listener + one realtime channel shared by header, bottom nav, etc. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const value = useSessionState()
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSessionProfile() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSessionProfile must be used inside <SessionProvider>')
  return ctx
}
