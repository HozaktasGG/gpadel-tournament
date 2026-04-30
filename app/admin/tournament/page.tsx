'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useAdmin } from '../admin-provider'
import AmericanoManager from './americano-manager'
import TeamManager from './team-manager'

type EventRow = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  format: string | null
  status: string
  max_players: number | null
}

export default function AdminTournamentPage() {
  const { password } = useAdmin()
  const supabase = createClient()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EventRow | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!password) return
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }

      const [{ data: profile }, { data: managers }] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle<{ is_admin: boolean | null }>(),
        supabase
          .from('event_managers')
          .select('event_id')
          .eq('user_id', user.id),
      ])

      if (cancelled) return

      const admin = !!profile?.is_admin
      const managedIds = (managers ?? []).map(m => m.event_id as string)
      setIsAdmin(admin)

      let query = supabase
        .from('events')
        .select('id, name, date, time, location, format, status, max_players')
        .in('status', ['upcoming', 'active'])
        .order('date', { ascending: true })

      if (!admin) {
        if (managedIds.length === 0) {
          if (!cancelled) {
            setEvents([])
            setLoading(false)
          }
          return
        }
        query = query.in('id', managedIds)
      }

      const { data } = await query
      if (cancelled) return
      setEvents((data ?? []) as EventRow[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [password, supabase])

  if (selected) {
    if (selected.format === 'Team') {
      return (
        <main className="min-h-screen p-6 sm:p-10" style={{ backgroundColor: '#1a3d2e' }}>
          <TeamManager
            eventId={selected.id}
            eventName={selected.name}
            onBack={() => setSelected(null)}
          />
        </main>
      )
    }
    return (
      <main className="min-h-screen p-6 sm:p-10" style={{ backgroundColor: '#1a3d2e' }}>
        <AmericanoManager eventId={selected.id} onBack={() => setSelected(null)} />
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 sm:p-10" style={{ backgroundColor: '#1a3d2e' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={44} height={44} className="rounded-full" />
            <h1 className="text-lg font-bold text-white">Tournament Admin</h1>
          </div>
          {isAdmin && (
            <a href="/admin" className="text-sm text-white/60 hover:text-white">← Admin</a>
          )}
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Select a Tournament</h2>
        <p className="text-sm text-white/60 mb-6">Choose an event to manage its tournament flow.</p>

        {loading ? (
          <p className="text-sm text-white/60">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-white/60">No upcoming or active tournaments.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map(ev => {
              const isTeam = ev.format === 'Team'
              return (
                <div
                  key={ev.id}
                  className="rounded-xl p-5"
                  style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-bold text-white leading-snug">{ev.name}</h3>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full whitespace-nowrap"
                      style={
                        isTeam
                          ? { backgroundColor: 'rgba(255,107,53,0.15)', color: '#ff6b35' }
                          : { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
                      }
                    >
                      {isTeam ? 'Team' : 'Americano'}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 mb-1">📅 {ev.date}{ev.time ? ` · ${ev.time}` : ''}</p>
                  {ev.location && <p className="text-xs text-white/60 mb-3">📍 {ev.location}</p>}
                  <button
                    type="button"
                    onClick={() => setSelected(ev)}
                    className="w-full py-2.5 rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: '#ff6b35' }}
                  >
                    Manage →
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
