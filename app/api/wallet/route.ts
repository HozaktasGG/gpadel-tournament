import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function formatIcsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Invalid link.' }, { status: 400 })
  }

  const { data: registration } = await supabaseAdmin
    .from('tournament_registrations')
    .select('id, first_name, last_name, email, email_verified, admin_approved')
    .eq('id', token)
    .eq('email_verified', true)
    .eq('admin_approved', true)
    .maybeSingle()

  if (!registration) {
    return NextResponse.json({ error: 'Invalid ticket.' }, { status: 403 })
  }

  // Tournament: April 24, 2026 at 17:00 Europe/Rome (UTC+2 in April DST)
  const startUtc = new Date(Date.UTC(2026, 3, 24, 15, 0, 0))
  const endUtc = new Date(Date.UTC(2026, 3, 24, 20, 0, 0))
  const createdUtc = new Date()

  const ticketUrl = `https://smashtorino.com/ticket?token=${registration.id}`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmashTorino//GPadel Tournament//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:gpadel-tournament-${registration.id}@smashtorino.com`,
    `DTSTAMP:${formatIcsDate(createdUtc)}`,
    `DTSTART:${formatIcsDate(startUtc)}`,
    `DTEND:${formatIcsDate(endUtc)}`,
    'SUMMARY:GPadel Tournament - SmashTorino',
    'LOCATION:GPadel Cenisia\\, Torino',
    `DESCRIPTION:Your ticket: ${ticketUrl}\\n\\nAttendee: ${registration.first_name} ${registration.last_name}\\n\\nShow your QR code at the entrance.`,
    `URL:${ticketUrl}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:GPadel Tournament starts in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="gpadel-tournament-${registration.id}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
