import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tournament_registrations')
    .update({ email_verified: true })
    .eq('id', token)
    .select('id')

  if (error) {
    console.error('Verify error:', error)
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
