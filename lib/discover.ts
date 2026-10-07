import { createClient } from '@/lib/supabase-server'
import { isTeamFormat } from '@/lib/event-format'
import { isEventLive } from '@/lib/event-status'

export type DiscoverEvent = {
  id: string
  name: string
  subtitle: string
  date: string
  time: string | null
  location: string | null
  format: string | null
  entryFee: number | null
  imageUrl: string | null
  featured: boolean
  isTeam: boolean
  /** Players for individual formats, teams for team formats. */
  filled: number
  capacity: number | null
  bucket: 'upcoming' | 'live' | 'completed'
}

export type LiveTournament = { currentRound: number | null; rounds: number; players: number } | null

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
  image_url: string | null
  featured?: boolean | null
  subtitle?: string | null
}

// Same "today" as the existing list page (server date).
function todayString() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export function subtitleFor(format: string | null, subtitle?: string | null) {
  if (subtitle?.trim()) return subtitle.trim()
  if (format === 'Team') return 'Team Tournament'
  return `${format ?? 'Americano'} Tournament`
}

export async function loadDiscover(): Promise<{ events: DiscoverEvent[]; liveTournament: LiveTournament }> {
  const supabase = await createClient()
  const today = todayString()

  const [{ data }, { data: active }] = await Promise.all([
    supabase.from('events').select('*').order('date', { ascending: true }),
    supabase.from('tournaments').select('id, current_round').eq('status', 'active').limit(1).maybeSingle(),
  ])
  const events = (data ?? []) as EventRow[]

  // Capacity counts — same rule as app/tournaments/page.tsx.
  const teamEventIds = events.filter(e => isTeamFormat(e.format)).map(e => e.id)
  const americanoEventIds = events.filter(e => !isTeamFormat(e.format)).map(e => e.id)
  const [teamRowsRes, regRowsRes, liveExtra] = await Promise.all([
    teamEventIds.length
      ? supabase.from('team_registrations').select('event_id').in('event_id', teamEventIds).eq('status', 'approved')
      : Promise.resolve({ data: [] as { event_id: string }[] }),
    americanoEventIds.length
      ? supabase.from('event_registrations').select('event_id').in('event_id', americanoEventIds).eq('status', 'approved')
      : Promise.resolve({ data: [] as { event_id: string }[] }),
    active
      ? Promise.all([
          supabase.from('tournament_players').select('id', { count: 'exact', head: true }).eq('tournament_id', active.id),
          supabase.from('tournament_rounds').select('id', { count: 'exact', head: true }).eq('tournament_id', active.id),
        ])
      : Promise.resolve(null),
  ])
  const countBy = (rows: { event_id: string }[] | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) m.set(r.event_id, (m.get(r.event_id) ?? 0) + 1)
    return m
  }
  const teamCount = countBy(teamRowsRes.data as { event_id: string }[] | null)
  const regCount = countBy(regRowsRes.data as { event_id: string }[] | null)

  const out: DiscoverEvent[] = events.map(ev => {
    const team = isTeamFormat(ev.format)
    const live = isEventLive(ev, !!active) || ev.status === 'active'
    const finished = ev.date < today || ev.status === 'finished' || ev.status === 'completed'
    return {
      id: ev.id,
      name: ev.name,
      subtitle: subtitleFor(ev.format, ev.subtitle),
      date: ev.date,
      time: ev.time,
      location: ev.location,
      format: ev.format,
      entryFee: ev.entry_fee,
      imageUrl: ev.image_url,
      featured: !!ev.featured,
      isTeam: team,
      filled: team ? teamCount.get(ev.id) ?? 0 : regCount.get(ev.id) ?? 0,
      capacity: ev.max_players ? (team ? Math.floor(ev.max_players / 2) : ev.max_players) : null,
      bucket: live ? 'live' : finished ? 'completed' : 'upcoming',
    }
  })

  return {
    events: out,
    liveTournament: active
      ? { currentRound: active.current_round ?? null, players: liveExtra?.[0].count ?? 0, rounds: liveExtra?.[1].count ?? 0 }
      : null,
  }
}
