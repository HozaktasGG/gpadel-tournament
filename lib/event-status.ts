import { EVENT_TIMEZONE } from '@/lib/config'

/** Current date (YYYY-MM-DD) and time (HH:mm) in Turin. */
export function nowInTurin(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/**
 * "Live" = (event is today in Turin AND its start time has passed AND status ≠ completed)
 *          OR the global live-scoring tournament is active.
 * The live-scoring tournament isn't linked to an event, so on a single event we only
 * apply the second rule to events happening today.
 */
export function isEventLive(
  ev: { date: string; time: string | null; status: string | null },
  liveTournamentActive: boolean,
  now = new Date()
) {
  const t = nowInTurin(now)
  if (ev.date !== t.date || ev.status === 'completed') return false
  const started = !ev.time || t.time >= ev.time.slice(0, 5).padStart(5, '0')
  return started || liveTournamentActive
}

export function formatEventDate(date: string, style: 'long' | 'short' = 'long') {
  const d = new Date(date + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: style === 'long' ? 'long' : 'short',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    ...(style === 'long' ? { year: 'numeric' } : {}),
  })
}

export function formatPrice(fee: number | null | undefined) {
  if (fee == null) return null
  if (fee === 0) return 'Free'
  return `€${Number.isInteger(fee) ? fee : fee.toFixed(2)}`
}
