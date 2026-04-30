import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function checkPassword(body: { password?: string }): boolean {
  return body.password === process.env.ADMIN_PASSWORD
}

// POST: list all event managers (with embedded event + profile)
export async function POST(req: NextRequest) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('event_managers')
    .select('id, user_id, event_id, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []
  const userIds = Array.from(new Set(rows.map(r => r.user_id as string).filter(Boolean)))
  const eventIds = Array.from(new Set(rows.map(r => r.event_id as string).filter(Boolean)))

  const [profilesRes, eventsRes] = await Promise.all([
    userIds.length
      ? supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }),
    eventIds.length
      ? supabaseAdmin
          .from('events')
          .select('id, name, date')
          .in('id', eventIds)
      : Promise.resolve({ data: [] as { id: string; name: string; date: string }[] }),
  ])

  const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]))
  const eventMap = new Map((eventsRes.data ?? []).map(e => [e.id, e]))

  const enriched = rows.map(r => ({
    id: r.id,
    user_id: r.user_id,
    event_id: r.event_id,
    profile: profileMap.get(r.user_id as string) ?? null,
    event: eventMap.get(r.event_id as string) ?? null,
  }))

  return NextResponse.json({ data: enriched })
}

// PUT: assign manager by email + eventId
export async function PUT(req: NextRequest) {
  let body: { password?: string; eventId?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const eventId = body.eventId?.trim()
  const email = body.email?.trim().toLowerCase()
  if (!eventId || !email) {
    return NextResponse.json({ error: 'Missing eventId or email.' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle<{ id: string }>()

  if (!profile) {
    return NextResponse.json({ error: 'No user with that email.' }, { status: 404 })
  }

  const { error: insertErr } = await supabaseAdmin
    .from('event_managers')
    .insert({ user_id: profile.id, event_id: eventId })

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'Already assigned.' }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE: remove manager by id
export async function DELETE(req: NextRequest) {
  let body: { password?: string; id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const id = body.id?.trim()
  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('event_managers')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
