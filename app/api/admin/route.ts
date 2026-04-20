import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

function checkPassword(body: { password?: string }) {
  return body.password === process.env.ADMIN_PASSWORD
}

// POST: şifre kontrolü + kayıtları listele
export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id, first_name, last_name, email, email_verified, admin_approved, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch registrations.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// PUT: admin_approved = true
export async function PUT(req: NextRequest) {
  const body = await req.json()

  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('tournament_registrations')
    .update({ admin_approved: true })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to approve.' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: kaydı sil
export async function DELETE(req: NextRequest) {
  const body = await req.json()

  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('tournament_registrations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to reject.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
