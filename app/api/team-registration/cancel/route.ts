import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RegistrationRow = {
  id: string
  captain_id: string
}

export async function DELETE(req: NextRequest) {
  let body: { registration_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const registration_id = body.registration_id?.trim()
  if (!registration_id) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data: registration } = await supabaseAdmin
    .from('team_registrations')
    .select('id, captain_id')
    .eq('id', registration_id)
    .maybeSingle<RegistrationRow>()

  if (!registration) {
    return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
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
    return NextResponse.json({ error: 'You are not authorized to delete this record.' }, { status: 403 })
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('team_registrations')
    .delete()
    .eq('id', registration.id)

  if (deleteErr) {
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
