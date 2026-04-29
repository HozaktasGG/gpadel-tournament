import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const resend = new Resend(process.env.RESEND_API_KEY)

type RegistrationRow = {
  id: string
  event_id: string
  team_name: string
  captain_id: string
  partner_id: string | null
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
}

type EventRow = {
  id: string
  name: string
  date: string | null
  location: string | null
}

function buildCancelEmail(args: {
  partnerFirstName: string
  captainName: string
  teamName: string
  event: EventRow
}) {
  const { partnerFirstName, captainName, teamName, event } = args
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#0f2318;color:#ffffff;border-radius:16px;overflow:hidden;">
      <div style="background:#1a3d2e;padding:28px 24px;text-align:center;border-bottom:3px solid #ff6b35;">
        <h1 style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">SmashTorino</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#ff6b35;font-weight:bold;">❌ Takım daveti geri çekildi</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#ffffff;margin:0 0 16px;">Merhaba <strong>${partnerFirstName}</strong>,</p>
        <p style="font-size:15px;color:#e6f0ea;margin:0 0 24px;line-height:1.5;">
          <strong>${captainName}</strong> takım davetini geri çekti. <strong>"${teamName}"</strong> takımı iptal edildi.
        </p>
        <div style="background:#1a3d2e;border:1px solid #2d5a40;border-radius:12px;padding:20px;margin:0 0 24px;">
          <p style="margin:0 0 12px;font-size:13px;color:#9bb5a5;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Etkinlik</p>
          <p style="margin:0;font-size:18px;font-weight:bold;color:#ffffff;">${event.name}</p>
          ${event.date ? `<p style="margin:8px 0 0;font-size:14px;color:#e6f0ea;">📅 ${event.date}</p>` : ''}
          ${event.location ? `<p style="margin:6px 0 0;font-size:14px;color:#e6f0ea;">📍 ${event.location}</p>` : ''}
        </div>
        <div style="text-align:center;margin:0 0 8px;">
          <a href="https://smashtorino.com/dashboard" style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:8px;">
            Dashboard'a Git
          </a>
        </div>
      </div>
      <div style="background:#0a1810;padding:18px 24px;text-align:center;border-top:1px solid #2d5a40;">
        <p style="margin:0;font-size:12px;color:#9bb5a5;">SmashTorino Padel Topluluğu</p>
      </div>
    </div>
  `
}

export async function DELETE(req: NextRequest) {
  let body: { registration_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const registration_id = body.registration_id?.trim()
  if (!registration_id) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Yetkilendirme gerekli.' }, { status: 401 })
  }

  const { data: registration } = await supabaseAdmin
    .from('team_registrations')
    .select('id, event_id, team_name, captain_id, partner_id, status')
    .eq('id', registration_id)
    .maybeSingle<RegistrationRow>()

  if (!registration) {
    return NextResponse.json({ error: 'Kayıt bulunamadı.' }, { status: 404 })
  }

  const isCaptain = registration.captain_id === user.id

  let isAdmin = false
  if (!isCaptain) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle<{ is_admin: boolean | null }>()
    isAdmin = !!profile?.is_admin
  }

  if (!isCaptain && !isAdmin) {
    return NextResponse.json({ error: 'Bu kaydı silme yetkiniz yok.' }, { status: 403 })
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('team_registrations')
    .delete()
    .eq('id', registration.id)

  if (deleteErr) {
    return NextResponse.json({ error: 'Silme başarısız.' }, { status: 500 })
  }

  if (registration.partner_id) {
    const [
      { data: eventData },
      { data: captainProfile },
      { data: partnerProfile },
    ] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select('id, name, date, location')
        .eq('id', registration.event_id)
        .maybeSingle<EventRow>(),
      supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', registration.captain_id)
        .maybeSingle<{ first_name: string | null; last_name: string | null }>(),
      supabaseAdmin
        .from('profiles')
        .select('first_name, email')
        .eq('id', registration.partner_id)
        .maybeSingle<{ first_name: string | null; email: string | null }>(),
    ])

    const captainName = [captainProfile?.first_name, captainProfile?.last_name]
      .filter(Boolean).join(' ').trim() || 'Kaptan'
    const partnerFirstName = partnerProfile?.first_name || 'Oyuncu'

    if (partnerProfile?.email && eventData) {
      try {
        await resend.emails.send({
          from: 'SmashTorino <info@smashtorino.com>',
          to: partnerProfile.email,
          subject: `❌ ${captainName} takım davetini geri çekti`,
          html: buildCancelEmail({
            partnerFirstName,
            captainName,
            teamName: registration.team_name,
            event: eventData,
          }),
        })
      } catch (err) {
        console.error('Failed to send cancel email:', err)
      }
    }
  }

  return NextResponse.json({ success: true })
}
