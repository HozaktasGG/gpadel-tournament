import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function checkPassword(body: { password?: string }) {
  return body.password === process.env.ADMIN_PASSWORD
}

// POST: list all event registrations
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: regs, error } = await supabaseAdmin
    .from('event_registrations')
    .select('id, status, created_at, event_id, user_id')
    .order('created_at', { ascending: false })

  if (error || !regs) {
    return NextResponse.json({ error: 'Failed to fetch registrations.' }, { status: 500 })
  }

  const eventIds = Array.from(new Set(regs.map(r => r.event_id)))
  const userIds = Array.from(new Set(regs.map(r => r.user_id)))

  const [{ data: events }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('events').select('id, name, date, time').in('id', eventIds),
    supabaseAdmin.from('profiles').select('id, first_name, last_name, email, phone, skill_score, skill_level').in('id', userIds),
  ])

  const eventMap = new Map((events ?? []).map(e => [e.id, e]))
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const data = regs.map(r => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    event_name: eventMap.get(r.event_id)?.name ?? null,
    event_date: eventMap.get(r.event_id)?.date ?? null,
    event_time: eventMap.get(r.event_id)?.time ?? null,
    first_name: profileMap.get(r.user_id)?.first_name ?? null,
    last_name: profileMap.get(r.user_id)?.last_name ?? null,
    email: profileMap.get(r.user_id)?.email ?? null,
    phone: profileMap.get(r.user_id)?.phone ?? null,
    skill_score: profileMap.get(r.user_id)?.skill_score ?? null,
    skill_level: profileMap.get(r.user_id)?.skill_level ?? null,
  }))

  return NextResponse.json({ data })
}

// PUT: approve
export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('event_registrations')
    .update({ status: 'approved' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to approve.' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: reject
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('event_registrations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to reject.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
