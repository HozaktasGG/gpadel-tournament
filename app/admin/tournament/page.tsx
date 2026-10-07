'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import AmericanoManager from './americano-manager'
import TeamManager from './team-manager'
import TeamAmericanoManager from './team-americano-manager'

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
  const supabase = createClient()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EventRow | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase
        .from('events')
        .select('id, name, date, time, location, format, status, max_players')
        .in('status', ['upcoming', 'active'])
        .order('date', { ascending: true })
      if (cancelled) return
      const rows = (data ?? []) as EventRow[]
      setEvents(rows)
      // "?event=<id>" (from Manage event → Fixtures) opens that event directly.
      const wanted = new URLSearchParams(window.location.search).get('event')
      const match = wanted ? rows.find(r => r.id === wanted) : undefined
      if (match) setSelected(match)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  if (selected) {
    if (selected.format === 'Team Americano') {
      return (
        <main className="min-h-dvh p-6 sm:p-10" style={{ backgroundColor: 'rgb(10 31 25)' }}>
          <TeamAmericanoManager
            eventId={selected.id}
            eventName={selected.name}
            onBack={() => setSelected(null)}
          />
        </main>
      )
    }
    if (selected.format === 'Team') {
      return (
        <main className="min-h-dvh p-6 sm:p-10" style={{ backgroundColor: 'rgb(10 31 25)' }}>
          <TeamManager
            eventId={selected.id}
            eventName={selected.name}
            onBack={() => setSelected(null)}
          />
        </main>
      )
    }
    return (
      <main className="min-h-dvh p-6 sm:p-10" style={{ backgroundColor: 'rgb(10 31 25)' }}>
        <AmericanoManager eventId={selected.id} onBack={() => setSelected(null)} />
      </main>
    )
  }

  return (
    <main className="min-h-dvh p-6 sm:p-10" style={{ backgroundColor: 'rgb(10 31 25)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={44} height={44} className="rounded-full" />
            <h1 className="font-display text-lg font-bold text-white">Tournament Admin</h1>
          </div>
          <a href="/admin" className="text-sm text-white/60 hover:text-white">← Admin</a>
        </div>

        <h2 className="font-display text-2xl font-bold text-white mb-2">Select a Tournament</h2>
        <p className="text-sm text-white/60 mb-6">Choose an event to manage its tournament flow.</p>

        {loading ? (
          <p className="text-sm text-white/60">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-white/60">No upcoming or active tournaments.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map(ev => {
              const isTeam = ev.format === 'Team'
              const isTeamAmericano = ev.format === 'Team Americano'
              const badgeStyle = isTeamAmericano
                ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                : isTeam
                ? { backgroundColor: 'rgba(255,107,53,0.15)', color: '#ff8a5c' }
                : { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
              const badgeLabel = isTeamAmericano ? 'Team Americano' : isTeam ? 'Team' : 'Americano'
              return (
                <div
                  key={ev.id}
                  className="rounded-xl p-5"
                  style={{ backgroundColor: 'rgb(7 24 18)', border: '1px solid #2d5a40' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-display text-base font-bold text-white leading-snug">{ev.name}</h3>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full whitespace-nowrap"
                      style={badgeStyle}
                    >
                      {badgeLabel}
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
