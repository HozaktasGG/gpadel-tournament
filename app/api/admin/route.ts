import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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
    .select('id, first_name, last_name, email, email_verified, admin_approved, checked_in, checked_in_at, created_at')
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

  const { data: registration, error: fetchError } = await supabase
    .from('tournament_registrations')
    .select('id, first_name, email')
    .eq('id', id)
    .single()

  if (fetchError || !registration) {
    return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
  }

  const { error } = await supabase
    .from('tournament_registrations')
    .update({ admin_approved: true })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to approve.' }, { status: 500 })

  // Sync to event_registrations if auth user exists
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authUser = users.find(u => u.email === registration.email)
  if (authUser) {
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (event) {
      await supabase
        .from('event_registrations')
        .upsert(
          { event_id: event.id, user_id: authUser.id, status: 'approved' },
          { onConflict: 'event_id,user_id' }
        )
    }
  }

  const participantsLink = `https://smashtorino.com/participants?token=${registration.id}`

  await resend.emails.send({
    from: 'info@smashtorino.com',
    to: registration.email,
    subject: "SmashTorino - You're In! ✅",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
        <p style="font-size:18px;font-weight:bold;color:#111;margin:0 0 8px;">Hi ${registration.first_name},</p>
        <p style="font-size:15px;color:#333;margin:0 0 24px;">Great news! Your registration has been approved!</p>

        <div style="background:#f9f9f9;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
          <p style="margin:0 0 10px;font-size:14px;color:#333;">📅 <strong>April 24, 2026</strong> — Friday</p>
          <p style="margin:0 0 10px;font-size:14px;color:#333;">🕐 <strong>17:00</strong></p>
          <p style="margin:0 0 10px;font-size:14px;color:#333;">📍 <strong>GPadel Cenisia</strong></p>
        </div>

        <a href="https://maps.app.goo.gl/ErzajT1oXJnkvBeF6"
           style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;margin-bottom:12px;">
          🗺️ Get Directions
        </a>

        <br/>

        <a href="${participantsLink}"
           style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;margin-bottom:28px;">
          👥 View All Participants
        </a>

        <p style="font-size:13px;color:#888;margin-top:32px;">See you on the court!<br/><strong style="color:#333;">SmashTorino Padel Community</strong></p>
      </div>
    `,
  })

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

  // Fetch email before deleting to clean up event_registrations
  const { data: reg } = await supabase
    .from('tournament_registrations')
    .select('email')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('tournament_registrations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to reject.' }, { status: 500 })

  // Delete from event_registrations if auth user exists
  if (reg?.email) {
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = users.find(u => u.email === reg.email)
    if (authUser) {
      await supabase
        .from('event_registrations')
        .delete()
        .eq('user_id', authUser.id)
    }
  }

  return NextResponse.json({ success: true })
}
