import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'

type EventRow = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  max_players: number | null
  format: string | null
  status: string
  entry_fee: number | null
  pdf_url: string | null
}

function todayString() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function formatDateLabel(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = params.tab === 'past' ? 'past' : 'upcoming'
  const todayStr = todayString()

  const supabase = await createClient()
  const query = supabase.from('events').select('*')

  const { data } = tab === 'upcoming'
    ? await query.gte('date', todayStr).order('date', { ascending: true })
    : await query.lt('date', todayStr).order('date', { ascending: false })

  const events = (data ?? []) as EventRow[]

  const eventCounts = await Promise.all(
    events.map(async ev => {
      if (ev.format === 'Team') {
        const { count } = await supabase
          .from('team_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', ev.id)
          .eq('status', 'approved')
        return { id: ev.id, count: (count ?? 0) * 2 }
      }
      const { count } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', ev.id)
        .eq('status', 'approved')
      return { id: ev.id, count: count ?? 0 }
    })
  )
  const countByEvent = Object.fromEntries(eventCounts.map(c => [c.id, c.count]))

  return (
    <main
      className="flex-1 py-12 px-4 sm:px-6"
      style={{ backgroundColor: '#1a3d2e' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Tournaments
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Browse upcoming events or look back at past tournaments.
          </p>
        </div>

        {/* Tabs */}
        <div
          className="inline-flex p-1 rounded-full mb-8"
          style={{
            backgroundColor: '#0f2a1f',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {(['upcoming', 'past'] as const).map(t => {
            const active = tab === t
            return (
              <Link
                key={t}
                href={t === 'upcoming' ? '/tournaments' : `/tournaments?tab=${t}`}
                className="px-5 py-2 rounded-full text-sm font-semibold transition"
                style={{
                  backgroundColor: active ? '#ff6b35' : 'transparent',
                  color: active ? 'white' : 'rgba(255,255,255,0.65)',
                }}
              >
                {t === 'upcoming' ? 'Upcoming' : 'Past'}
              </Link>
            )
          })}
        </div>

        {events.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{
              backgroundColor: '#0f2a1f',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <p className="text-sm text-white/70">
              {tab === 'upcoming'
                ? 'No upcoming tournaments right now — check back soon!'
                : 'No past tournaments yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map(ev => {
              const isPast = tab === 'past'
              return (
                <Link
                  key={ev.id}
                  href={`/tournaments/${ev.id}`}
                  className="block rounded-2xl p-6 transition hover:-translate-y-1"
                  style={{
                    backgroundColor: '#0f2a1f',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: isPast
                          ? 'rgba(255,255,255,0.08)'
                          : ev.status === 'active'
                            ? 'rgba(34,197,94,0.15)'
                            : 'rgba(255,107,53,0.15)',
                        color: isPast
                          ? 'rgba(255,255,255,0.5)'
                          : ev.status === 'active'
                            ? '#22c55e'
                            : '#ff6b35',
                      }}
                    >
                      {isPast ? 'Finished' : ev.status === 'active' ? '● Live' : 'Upcoming'}
                    </span>
                    {ev.format && (
                      <span className="text-[10px] text-white/40 font-semibold">
                        {ev.format}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white leading-snug">
                    {ev.name}
                  </h3>
                  <div className="mt-4 space-y-1.5 text-sm text-white/70">
                    <p>📅 {formatDateLabel(ev.date)}</p>
                    {ev.time && <p>🕐 {ev.time}</p>}
                    {ev.location && <p>📍 {ev.location}</p>}
                  </div>
                  <div
                    className="mt-5 pt-4"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-xs text-white/70 font-semibold mb-3">
                      {countByEvent[ev.id] ?? 0} / {ev.max_players ?? 0} Spots Filled
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">
                        {ev.entry_fee ? `€${ev.entry_fee}` : 'Free'}
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: '#ff6b35' }}
                      >
                        Details →
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
