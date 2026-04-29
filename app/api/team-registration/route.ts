import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  player_code: string | null
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
    .select('id')
    .eq('id', event_id)
    .maybeSingle<{ id: string }>()

  if (!eventData) {
    return NextResponse.json({ error: 'Etkinlik bulunamadı.' }, { status: 404 })
  }

  const { data: partnerProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, player_code')
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

  const partnerName = [partnerProfile.first_name, partnerProfile.last_name]
    .filter(Boolean).join(' ').trim() || partner_code

  return NextResponse.json({
    success: true,
    registration_id: inserted.id,
    partner_name: partnerName,
  })
}
