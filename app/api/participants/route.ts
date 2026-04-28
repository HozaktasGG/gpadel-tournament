import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Invalid link.' }, { status: 400 })
  }

  const { data: registration } = await supabaseAdmin
    .from('tournament_registrations')
    .select('id')
    .eq('id', token)
    .eq('email_verified', true)
    .eq('admin_approved', true)
    .maybeSingle()

  if (!registration) {
    return NextResponse.json({ error: 'Invalid link. Only registered participants can view this page.' }, { status: 403 })
  }

  const { data: participants, error } = await supabaseAdmin
    .from('tournament_registrations')
    .select('id, first_name, last_name')
    .eq('email_verified', true)
    .eq('admin_approved', true)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch participants.' }, { status: 500 })
  }

  return NextResponse.json({ data: participants })
}
