import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

function checkPassword(password?: string) {
  return password === process.env.ADMIN_PASSWORD
}

// POST { password, id? } => if id given: check in that id; otherwise return full list
export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = body

  if (id) {
    const { data: registration, error: fetchError } = await supabase
      .from('tournament_registrations')
      .select('id, first_name, last_name, email, email_verified, admin_approved, checked_in, checked_in_at')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !registration) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
    }

    if (!registration.email_verified || !registration.admin_approved) {
      return NextResponse.json(
        { error: 'This registration is not approved.', registration },
        { status: 403 }
      )
    }

    if (registration.checked_in) {
      return NextResponse.json({
        alreadyCheckedIn: true,
        registration,
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from('tournament_registrations')
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, first_name, last_name, email, checked_in, checked_in_at')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Failed to check in.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, registration: updated })
  }

  // No id => list all approved registrations with check-in status
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id, first_name, last_name, email, checked_in, checked_in_at')
    .eq('email_verified', true)
    .eq('admin_approved', true)
    .order('checked_in_at', { ascending: false, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch registrations.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
