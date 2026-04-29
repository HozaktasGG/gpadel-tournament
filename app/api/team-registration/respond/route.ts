import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RegistrationRow = {
  id: string
  partner_id: string | null
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
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

  if (!registration_id || (action !== 'accept' && action !== 'reject')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Yetkilendirme gerekli.' }, { status: 401 })
  }

  const { data: registration } = await supabaseAdmin
    .from('team_registrations')
    .select('id, partner_id, status')
    .eq('id', registration_id)
    .maybeSingle<RegistrationRow>()

  if (!registration) {
    return NextResponse.json({ error: 'Davet bulunamadı.' }, { status: 404 })
  }

  if (registration.partner_id !== user.id) {
    return NextResponse.json({ error: 'Bu daveti yanıtlama yetkiniz yok.' }, { status: 403 })
  }

  if (registration.status !== 'pending_partner') {
    return NextResponse.json({ error: 'Bu davet zaten yanıtlandı.' }, { status: 409 })
  }

  const accepted = action === 'accept'

  const { error: updateErr } = await supabaseAdmin
    .from('team_registrations')
    .update({
      status: accepted ? 'pending_approval' : 'rejected',
      partner_confirmed: accepted,
    })
    .eq('id', registration.id)

  if (updateErr) {
    return NextResponse.json({ error: 'Güncelleme başarısız.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    status: accepted ? 'pending_approval' : 'rejected',
  })
}
