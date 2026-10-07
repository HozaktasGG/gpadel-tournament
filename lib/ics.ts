import { CALENDAR_DEFAULT_DURATION_MIN, EVENT_TIMEZONE } from '@/lib/config'

export type CalendarEvent = {
  id: string
  name: string
  /** YYYY-MM-DD (Turin local date) */
  date: string
  /** HH:mm (Turin local time); null = all-day */
  time: string | null
  location: string | null
  description?: string | null
  url: string
}

// RFC 5545 text escaping + 75-octet line folding.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m)
function fold(line: string) {
  const out: string[] = []
  let rest = line
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--
    out.push(rest.slice(0, cut))
    rest = ' ' + rest.slice(cut)
  }
  out.push(rest)
  return out.join('\r\n')
}

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

// Europe/Rome rules (CET/CEST) so iOS/Google/Outlook place the event correctly.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${EVENT_TIMEZONE}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

export function buildIcs(ev: CalendarEvent): string {
  const [y, m, d] = ev.date.split('-').map(Number)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SmashTorino//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  let when: string[]
  const time = ev.time?.match(/^(\d{1,2}):(\d{2})/)
  if (time) {
    lines.push(...VTIMEZONE)
    // Floating wall-clock arithmetic in local time; the TZID gives it meaning.
    const start = new Date(Date.UTC(y, m - 1, d, Number(time[1]), Number(time[2])))
    const end = new Date(start.getTime() + CALENDAR_DEFAULT_DURATION_MIN * 60_000)
    const local = (t: Date) => stamp(t).slice(0, -1) // drop "Z"
    when = [`DTSTART;TZID=${EVENT_TIMEZONE}:${local(start)}`, `DTEND;TZID=${EVENT_TIMEZONE}:${local(end)}`]
  } else {
    const next = new Date(Date.UTC(y, m - 1, d + 1))
    when = [`DTSTART;VALUE=DATE:${ev.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${stamp(next).slice(0, 8)}`]
  }
  lines.push(
    'BEGIN:VEVENT',
    `UID:${ev.id}@smashtorino.com`,
    `DTSTAMP:${stamp(new Date())}`,
    ...when,
    `SUMMARY:${esc(ev.name)}`,
    ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
    `DESCRIPTION:${esc([ev.description?.trim(), ev.url].filter(Boolean).join('\n\n'))}`,
    `URL:${ev.url}`,
    'END:VEVENT',
    'END:VCALENDAR'
  )
  return lines.map(fold).join('\r\n') + '\r\n'
}

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/**
 * iOS: open the .ics as a data URL so Safari shows the native "Add to Calendar" sheet.
 * Elsewhere: download a .ics file.
 */
export function openIcs(ev: CalendarEvent) {
  const ics = buildIcs(ev)
  if (isIOS()) {
    window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)
    return
  }
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
