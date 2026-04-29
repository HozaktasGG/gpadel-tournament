import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function checkPassword(body: { password?: string }) {
  return body.password === process.env.ADMIN_PASSWORD
}

type EventInput = {
  name: string
  date: string
  time: string | null
  location: string | null
  max_players: number | null
  entry_fee: number | null
  format: string | null
  description: string | null
  status: string
  pdf_url: string | null
}

function sanitizeEvent(raw: any): Partial<EventInput> {
  const out: Partial<EventInput> = {}
  if (typeof raw?.name === 'string') out.name = raw.name.trim()
  if (typeof raw?.date === 'string') out.date = raw.date
  if (raw?.time === null || typeof raw?.time === 'string') out.time = raw.time
  if (raw?.location === null || typeof raw?.location === 'string') out.location = raw.location
  if (raw?.max_players === null || typeof raw?.max_players === 'number') out.max_players = raw.max_players
  if (raw?.entry_fee === null || typeof raw?.entry_fee === 'number') out.entry_fee = raw.entry_fee
  if (raw?.format === null || typeof raw?.format === 'string') out.format = raw.format
  if (raw?.description === null || typeof raw?.description === 'string') out.description = raw.description
  if (typeof raw?.status === 'string') out.status = raw.status
  if (raw?.pdf_url === null || typeof raw?.pdf_url === 'string') out.pdf_url = raw.pdf_url
  return out
}

// POST: list events OR create (with action field)
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (body.action === 'create') {
    const payload = sanitizeEvent(body.event)
    if (!payload.name || !payload.date) {
      return NextResponse.json({ error: 'name and date are required' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert(payload)
      .select()
      .single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  }

  // default: list
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('date', { ascending: false })
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch events.' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

// PUT: update event
export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }
  const payload = sanitizeEvent(body.event)
  const { data, error } = await supabaseAdmin
    .from('events')
    .update(payload)
    .eq('id', body.id)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

// DELETE: delete event
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('events')
    .delete()
    .eq('id', body.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
