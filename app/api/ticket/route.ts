import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Invalid link.' }, { status: 400 })
  }

  const { data: registration } = await supabaseAdmin
    .from('tournament_registrations')
    .select('id, first_name, last_name, email, email_verified, admin_approved, checked_in')
    .eq('id', token)
    .eq('email_verified', true)
    .eq('admin_approved', true)
    .maybeSingle()

  if (!registration) {
    return NextResponse.json(
      { error: 'Invalid ticket. Your registration must be approved to access a ticket.' },
      { status: 403 }
    )
  }

  const qrPayload = JSON.stringify({
    id: registration.id,
    name: `${registration.first_name} ${registration.last_name}`,
    email: registration.email,
    event: 'GPadel Tournament',
    date: '2026-04-24',
    time: '17:00',
  })

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
    color: {
      dark: '#1a3d2e',
      light: '#ffffff',
    },
  })

  return NextResponse.json({
    id: registration.id,
    firstName: registration.first_name,
    lastName: registration.last_name,
    email: registration.email,
    checkedIn: registration.checked_in ?? false,
    event: 'GPadel Tournament',
    date: '2026-04-24',
    dateLabel: 'April 24, 2026 — Friday',
    time: '17:00',
    venue: 'GPadel Cenisia',
    qr: qrDataUrl,
  })
}
