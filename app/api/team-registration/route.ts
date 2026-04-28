import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const resend = new Resend(process.env.RESEND_API_KEY)

type EventRow = {
  id: string
  name: string
  date: string | null
  time: string | null
  location: string | null
}

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  player_code: string | null
}

function formatTrDate(date: string | null): string {
  if (!date) return ''
  try {
    return new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return date
  }
}

function buildInviteEmail(args: {
  captainName: string
  partnerFirstName: string
  teamName: string
  event: EventRow
  acceptLink: string
  rejectLink: string
}) {
  const { captainName, partnerFirstName, teamName, event, acceptLink, rejectLink } = args
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#0f2318;color:#ffffff;border-radius:16px;overflow:hidden;">
      <div style="background:#1a3d2e;padding:28px 24px;text-align:center;border-bottom:3px solid #ff6b35;">
        <h1 style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">SmashTorino</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#ff6b35;font-weight:bold;">🎾 Takım Daveti</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#ffffff;margin:0 0 16px;">Merhaba <strong>${partnerFirstName}</strong>,</p>
        <p style="font-size:15px;color:#e6f0ea;margin:0 0 24px;line-height:1.5;">
          <strong>${captainName}</strong> seni <strong style="color:#ff6b35;">"${teamName}"</strong> takımına partner olarak davet etti!
        </p>
        <div style="background:#1a3d2e;border:1px solid #2d5a40;border-radius:12px;padding:20px;margin:0 0 24px;">
          <p style="margin:0 0 12px;font-size:13px;color:#9bb5a5;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Etkinlik</p>
          <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#ffffff;">${event.name}</p>
          ${event.date ? `<p style="margin:0 0 4px;font-size:14px;color:#e6f0ea;">📅 ${formatTrDate(event.date)}</p>` : ''}
          ${event.time ? `<p style="margin:0 0 4px;font-size:14px;color:#e6f0ea;">🕐 ${event.time}</p>` : ''}
          ${event.location ? `<p style="margin:0;font-size:14px;color:#e6f0ea;">📍 ${event.location}</p>` : ''}
        </div>
        <p style="font-size:14px;color:#e6f0ea;margin:0 0 20px;">Daveti yanıtlamak için aşağıdaki butonlardan birine tıkla:</p>
        <div style="text-align:center;margin:0 0 24px;">
          <a href="${acceptLink}" style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:14px 28px;border-radius:8px;margin:0 6px 10px;">
            ✅ Daveti Kabul Et
          </a>
          <a href="${rejectLink}" style="display:inline-block;background:transparent;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:14px 28px;border-radius:8px;border:1px solid #2d5a40;margin:0 6px 10px;">
            ❌ Reddet
          </a>
        </div>
        <p style="font-size:12px;color:#9bb5a5;margin:0;text-align:center;line-height:1.5;">
          Buton çalışmıyorsa: <span style="color:#ff6b35;word-break:break-all;">${acceptLink}</span>
        </p>
      </div>
      <div style="background:#0a1810;padding:18px 24px;text-align:center;border-top:1px solid #2d5a40;">
        <p style="margin:0;font-size:12px;color:#9bb5a5;">SmashTorino Padel Topluluğu</p>
      </div>
    </div>
  `
}

export async function POST(req: NextRequest) {
  let body: { event_id?: string; team_name?: string; partner_code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const event_id = body.event_id?.trim()
  const team_name = body.team_name?.trim()
  const rawCode = body.partner_code?.trim().toUpperCase()

  if (!event_id || !team_name || !rawCode) {
    return NextResponse.json({ error: 'Tüm alanlar zorunludur.' }, { status: 400 })
  }
  if (team_name.length > 30) {
    return NextResponse.json({ error: 'Takım adı en fazla 30 karakter olabilir.' }, { status: 400 })
  }

  const partner_code = rawCode.startsWith('SMASH-') ? rawCode : `SMASH-${rawCode}`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Yetkilendirme gerekli.' }, { status: 401 })
  }

  const { data: eventData } = await supabaseAdmin
    .from('events')
    .select('id, name, date, time, location')
    .eq('id', event_id)
    .maybeSingle<EventRow>()

  if (!eventData) {
    return NextResponse.json({ error: 'Etkinlik bulunamadı.' }, { status: 404 })
  }

  const { data: partnerProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, player_code')
    .eq('player_code', partner_code)
    .maybeSingle<ProfileRow>()

  if (!partnerProfile) {
    return NextResponse.json({ error: 'Oyuncu kodu bulunamadı.' }, { status: 404 })
  }

  if (partnerProfile.id === user.id) {
    return NextResponse.json({ error: 'Kendinizi partner olarak ekleyemezsiniz.' }, { status: 400 })
  }

  const { data: existingForCaptain } = await supabaseAdmin
    .from('team_registrations')
    .select('id')
    .eq('event_id', event_id)
    .eq('captain_id', user.id)
    .neq('status', 'rejected')
    .maybeSingle()

  if (existingForCaptain) {
    return NextResponse.json({ error: 'Bu etkinliğe zaten kayıtlısınız.' }, { status: 409 })
  }

  const { data: existingForPartner } = await supabaseAdmin
    .from('team_registrations')
    .select('id')
    .eq('event_id', event_id)
    .or(`captain_id.eq.${partnerProfile.id},partner_id.eq.${partnerProfile.id}`)
    .neq('status', 'rejected')
    .maybeSingle()

  if (existingForPartner) {
    return NextResponse.json({ error: 'Bu oyuncu zaten başka bir takımda.' }, { status: 409 })
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('team_registrations')
    .insert({
      event_id,
      team_name,
      captain_id: user.id,
      partner_id: partnerProfile.id,
      partner_code,
      status: 'pending_partner',
      captain_confirmed: true,
      partner_confirmed: false,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json({ error: 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.' }, { status: 500 })
  }

  const { data: captainProfile } = await supabaseAdmin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle<{ first_name: string | null; last_name: string | null }>()

  const captainName = [captainProfile?.first_name, captainProfile?.last_name]
    .filter(Boolean).join(' ').trim() || user.email || 'Bir oyuncu'
  const partnerFirstName = partnerProfile.first_name || 'Oyuncu'
  const partnerName = [partnerProfile.first_name, partnerProfile.last_name]
    .filter(Boolean).join(' ').trim() || partner_code

  if (partnerProfile.email) {
    const acceptLink = `https://smashtorino.com/team-invite/${inserted.id}?action=accept`
    const rejectLink = `https://smashtorino.com/team-invite/${inserted.id}?action=reject`
    try {
      await resend.emails.send({
        from: 'SmashTorino <info@smashtorino.com>',
        to: partnerProfile.email,
        subject: `${captainName} sizi takımına davet etti! 🎾`,
        html: buildInviteEmail({
          captainName,
          partnerFirstName,
          teamName: team_name,
          event: eventData,
          acceptLink,
          rejectLink,
        }),
      })
    } catch (err) {
      console.error('Failed to send invite email:', err)
    }
  }

  return NextResponse.json({
    success: true,
    registration_id: inserted.id,
    partner_name: partnerName,
  })
}
