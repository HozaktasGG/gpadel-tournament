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

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

function buildResultEmail(args: {
  recipientFirstName: string
  teamName: string
  event: EventRow
  approved: boolean
}) {
  const { recipientFirstName, teamName, event, approved } = args
  const headline = approved
    ? `🎉 ${teamName} takımınız onaylandı!`
    : `❌ ${teamName} takımınız onaylanmadı`
  const body = approved
    ? `Tebrikler! <strong>"${teamName}"</strong> takımınız <strong>${event.name}</strong> turnuvasına resmi olarak katılmaya hak kazandı. Turnuvada görüşürüz! 🎾`
    : `Maalesef <strong>"${teamName}"</strong> takımınız <strong>${event.name}</strong> turnuvası için onaylanmadı. Sorularınız varsa bizimle iletişime geçebilirsiniz.`

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#0f2318;color:#ffffff;border-radius:16px;overflow:hidden;">
      <div style="background:#1a3d2e;padding:28px 24px;text-align:center;border-bottom:3px solid #ff6b35;">
        <h1 style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">SmashTorino</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#ff6b35;font-weight:bold;">${headline}</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#ffffff;margin:0 0 16px;">Merhaba <strong>${recipientFirstName}</strong>,</p>
        <p style="font-size:15px;color:#e6f0ea;margin:0 0 24px;line-height:1.5;">${body}</p>
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

export async function POST(req: NextRequest) {
  let body: { registration_id?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const registration_id = body.registration_id?.trim()
  const action = body.action

  if (!registration_id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Yetkilendirme gerekli.' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_admin: boolean | null }>()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 })
  }

  const { data: registration } = await supabaseAdmin
    .from('team_registrations')
    .select('id, event_id, team_name, captain_id, partner_id, status')
    .eq('id', registration_id)
    .maybeSingle<RegistrationRow>()

  if (!registration) {
    return NextResponse.json({ error: 'Takım kaydı bulunamadı.' }, { status: 404 })
  }

  const approved = action === 'approve'
  const newStatus = approved ? 'approved' : 'rejected'

  const { error: updateErr } = await supabaseAdmin
    .from('team_registrations')
    .update({ status: newStatus })
    .eq('id', registration.id)

  if (updateErr) {
    return NextResponse.json({ error: 'Güncelleme başarısız.' }, { status: 500 })
  }

  const memberIds = [registration.captain_id]
  if (registration.partner_id) memberIds.push(registration.partner_id)

  const [{ data: eventData }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, name, date, location')
      .eq('id', registration.event_id)
      .maybeSingle<EventRow>(),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', memberIds),
  ])

  if (eventData && members) {
    const subject = approved
      ? `🎉 ${registration.team_name} takımınız onaylandı!`
      : `❌ ${registration.team_name} takımınız onaylanmadı`

    await Promise.all(
      (members as ProfileRow[])
        .filter(m => !!m.email)
        .map(m =>
          resend.emails.send({
            from: 'SmashTorino <info@smashtorino.com>',
            to: m.email!,
            subject,
            html: buildResultEmail({
              recipientFirstName: m.first_name || 'Oyuncu',
              teamName: registration.team_name,
              event: eventData,
              approved,
            }),
          }).catch((err) => {
            console.error(`Failed to send team-approval email to ${m.email}:`, err)
          })
        )
    )
  }

  return NextResponse.json({ success: true })
}
