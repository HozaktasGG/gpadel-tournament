import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const resend = new Resend(process.env.RESEND_API_KEY)

type RegistrationRow = {
  id: string
  partner_id: string | null
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
}

type ProfileEmbed = {
  first_name: string | null
  last_name: string | null
  email: string | null
}

type EventEmbed = {
  name: string | null
  date: string | null
  time: string | null
  location: string | null
  description: string | null
}

type FullRegistrationRaw = {
  id: string
  team_name: string
  event: EventEmbed | EventEmbed[] | null
  captain: ProfileEmbed | ProfileEmbed[] | null
  partner: ProfileEmbed | ProfileEmbed[] | null
}

function unwrap<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

function fullName(p: ProfileEmbed | null, fallback = 'Player'): string {
  if (!p) return fallback
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || fallback
}

function formatDate(date: string | null): string {
  if (!date) return ''
  try {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return date
  }
}

function buildConfirmationEmail(args: {
  recipientFirstName: string
  partnerFullName: string
  teamName: string
  event: EventEmbed
}): string {
  const { recipientFirstName, partnerFullName, teamName, event } = args
  const directionsUrl = event.location
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location)}`
    : null

  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#0f1923;color:#ffffff;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(to right,#8B1A1A 50%,#1a2744 50%);padding:36px 24px;text-align:center;">
    <img src="https://smashtorino.com/collab-logo.png" width="280" alt="Chase The Red x SmashTorino" style="display:inline-block;max-width:100%;height:auto;border:0;" />
  </div>

  <div style="padding:36px 28px;">
    <p style="font-size:14px;color:#9bb5a5;margin:0 0 8px;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">Hi ${recipientFirstName},</p>
    <h1 style="margin:0 0 24px;font-size:28px;font-weight:bold;color:#ffffff;line-height:1.2;">Your team is confirmed!</h1>

    <p style="margin:0 0 6px;font-size:13px;color:#9bb5a5;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Team</p>
    <p style="margin:0 0 24px;font-size:32px;font-weight:bold;color:#ff6b35;line-height:1.1;">${teamName}</p>

    <p style="margin:0 0 28px;font-size:15px;color:#e6f0ea;">
      <span style="color:#9bb5a5;">Your partner:</span> <strong style="color:#ffffff;">${partnerFullName}</strong>
    </p>

    <div style="background:#1a2744;border-radius:12px;padding:22px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:12px;color:#9bb5a5;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;">Event</p>
      <p style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#ffffff;">${event.name ?? ''}</p>
      ${event.date ? `<p style="margin:0 0 8px;font-size:14px;color:#e6f0ea;">📅 ${formatDate(event.date)}</p>` : ''}
      ${event.time ? `<p style="margin:0 0 8px;font-size:14px;color:#e6f0ea;">🕐 ${event.time}</p>` : ''}
      ${event.location ? `<p style="margin:0 0 14px;font-size:14px;color:#e6f0ea;">📍 ${event.location}</p>` : ''}
      ${directionsUrl ? `<a href="${directionsUrl}" style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;padding:8px 16px;border-radius:8px;">Get Directions →</a>` : ''}
    </div>

    ${event.description ? `<div style="background:rgba(255,255,255,0.04);border-left:3px solid #ff6b35;padding:16px 18px;border-radius:6px;margin:0 0 24px;"><p style="margin:0;font-size:14px;color:#e6f0ea;line-height:1.6;">${event.description}</p></div>` : ''}

    <p style="margin:32px 0 0;font-size:15px;color:#e6f0ea;">Good luck! 🎾</p>
    <p style="margin:4px 0 0;font-size:14px;color:#9bb5a5;">— SmashTorino Team</p>
  </div>

  <div style="background:#0a1018;padding:18px 24px;text-align:center;border-top:1px solid #1a2744;">
    <p style="margin:0 0 8px;font-size:12px;color:#9bb5a5;">SmashTorino × Chase The Red</p>
    <a href="https://instagram.com/smashtorino" style="font-size:12px;color:#ff6b35;text-decoration:none;font-weight:bold;">@smashtorino on Instagram</a>
  </div>
</div>
`
}

async function sendConfirmationEmails(registrationId: string, teamName: string) {
  const { data } = await supabaseAdmin
    .from('team_registrations')
    .select(
      'id, team_name, event:events(name, date, time, location, description), captain:profiles!team_registrations_captain_id_fkey(first_name, last_name, email), partner:profiles!team_registrations_partner_id_fkey(first_name, last_name, email)'
    )
    .eq('id', registrationId)
    .single<FullRegistrationRaw>()

  if (!data) return

  const event = unwrap(data.event)
  const captain = unwrap(data.captain)
  const partner = unwrap(data.partner)

  if (!event || !captain || !partner) return

  const captainName = fullName(captain, 'Captain')
  const partnerName = fullName(partner, 'Partner')
  const subject = `🎾 You're registered! ${teamName} · ${event.name ?? 'SmashTorino'}`

  const sends: Promise<unknown>[] = []

  if (captain.email) {
    sends.push(
      resend.emails.send({
        from: 'SmashTorino <info@smashtorino.com>',
        to: captain.email,
        subject,
        html: buildConfirmationEmail({
          recipientFirstName: captain.first_name || 'Captain',
          partnerFullName: partnerName,
          teamName,
          event,
        }),
      }).catch(err => {
        console.error('Failed to send confirmation to captain:', err)
      })
    )
  }

  if (partner.email) {
    sends.push(
      resend.emails.send({
        from: 'SmashTorino <info@smashtorino.com>',
        to: partner.email,
        subject,
        html: buildConfirmationEmail({
          recipientFirstName: partner.first_name || 'Partner',
          partnerFullName: captainName,
          teamName,
          event,
        }),
      }).catch(err => {
        console.error('Failed to send confirmation to partner:', err)
      })
    )
  }

  await Promise.all(sends)
}

export async function POST(req: NextRequest) {
  let body: { registration_id?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const registration_id = body.registration_id?.trim()
  const action = body.action

  if (!registration_id || (action !== 'accept' && action !== 'reject')) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data: registration } = await supabaseAdmin
    .from('team_registrations')
    .select('id, partner_id, status')
    .eq('id', registration_id)
    .maybeSingle<RegistrationRow>()

  if (!registration) {
    return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
  }

  if (registration.partner_id !== user.id) {
    return NextResponse.json({ error: 'You are not authorized to respond to this invite.' }, { status: 403 })
  }

  if (registration.status !== 'pending_partner') {
    return NextResponse.json({ error: 'This invite has already been responded to.' }, { status: 409 })
  }

  const accepted = action === 'accept'

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('team_registrations')
    .update({
      status: accepted ? 'approved' : 'rejected',
      partner_confirmed: accepted,
    })
    .eq('id', registration.id)
    .select('id, team_name')
    .single<{ id: string; team_name: string }>()

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  }

  if (accepted) {
    try {
      await sendConfirmationEmails(updated.id, updated.team_name)
    } catch (err) {
      console.error('Confirmation email error:', err)
    }
  }

  return NextResponse.json({
    success: true,
    status: accepted ? 'approved' : 'rejected',
  })
}
