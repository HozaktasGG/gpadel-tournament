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
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const event_id = body.event_id?.trim()
  const team_name = body.team_name?.trim()
  const rawCode = body.partner_code?.trim().toUpperCase()

  if (!event_id || !team_name || !rawCode) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }
  if (team_name.length > 30) {
    return NextResponse.json({ error: 'Team name can be at most 30 characters.' }, { status: 400 })
  }

  const partner_code = rawCode.startsWith('SMASH-') ? rawCode : `SMASH-${rawCode}`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data: captainProfile } = await supabaseAdmin
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle<{ phone: string | null }>()

  if (!captainProfile?.phone || captainProfile.phone.trim() === '') {
    return NextResponse.json(
      { error: 'Please add a phone number to your profile first.' },
      { status: 400 }
    )
  }

  const { data: eventData } = await supabaseAdmin
    .from('events')
    .select('id')
    .eq('id', event_id)
    .maybeSingle<{ id: string }>()

  if (!eventData) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  }

  const { data: partnerProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, player_code')
    .eq('player_code', partner_code)
    .maybeSingle<ProfileRow>()

  if (!partnerProfile) {
    return NextResponse.json({ error: 'Player code not found.' }, { status: 404 })
  }

  if (partnerProfile.id === user.id) {
    return NextResponse.json({ error: 'You cannot add yourself as your partner.' }, { status: 400 })
  }

  const { data: existingForCaptain } = await supabaseAdmin
    .from('team_registrations')
    .select('id')
    .eq('event_id', event_id)
    .eq('captain_id', user.id)
    .neq('status', 'rejected')
    .maybeSingle()

  if (existingForCaptain) {
    return NextResponse.json({ error: 'You are already registered for this event.' }, { status: 409 })
  }

  const { data: existingForPartner } = await supabaseAdmin
    .from('team_registrations')
    .select('id')
    .eq('event_id', event_id)
    .or(`captain_id.eq.${partnerProfile.id},partner_id.eq.${partnerProfile.id}`)
    .neq('status', 'rejected')
    .maybeSingle()

  if (existingForPartner) {
    return NextResponse.json({ error: 'This player is already in another team.' }, { status: 409 })
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
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }

  const partnerName = [partnerProfile.first_name, partnerProfile.last_name]
    .filter(Boolean).join(' ').trim() || partner_code

  return NextResponse.json({
    success: true,
    registration_id: inserted.id,
    partner_name: partnerName,
  })
}
