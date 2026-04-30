import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  let body: { password?: string; eventId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const eventId = body.eventId?.trim()
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  }

  const [matchesRes, groupsRes] = await Promise.all([
    supabaseAdmin
      .from('team_tournament_matches')
      .delete()
      .eq('event_id', eventId),
    supabaseAdmin
      .from('team_tournament_groups')
      .delete()
      .eq('event_id', eventId),
  ])

  if (matchesRes.error) {
    return NextResponse.json({ error: 'Reset failed: ' + matchesRes.error.message }, { status: 500 })
  }
  if (groupsRes.error) {
    return NextResponse.json({ error: 'Reset failed: ' + groupsRes.error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
