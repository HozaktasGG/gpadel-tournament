import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// April 24, 2026 17:00 CET (UTC+2 in summer) = 15:00 UTC
const TOURNAMENT_DATE = new Date('2026-04-24T15:00:00Z')

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
  }

  const now = new Date()
  const msUntilTournament = TOURNAMENT_DATE.getTime() - now.getTime()
  const hoursUntilTournament = msUntilTournament / (1000 * 60 * 60)

  if (hoursUntilTournament < 24) {
    return NextResponse.json(
      { error: 'Cancellation is no longer available. You can only cancel up to 24 hours before the tournament.' },
      { status: 403 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('tournament_registrations')
    .delete()
    .eq('id', token)
    .select('id')

  if (error) {
    console.error('Cancel error:', error)
    return NextResponse.json({ error: 'Cancellation failed. Please try again.' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
