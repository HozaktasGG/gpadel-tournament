import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ZERO = '00000000-0000-0000-0000-000000000000'

export async function POST(req: Request) {
  try {
    const { password } = await req.json()
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('RESET: wiping all tournament tables')
    const m = await supabase.from('tournament_matches').delete().neq('id', ZERO)
    if (m.error) throw m.error
    const r = await supabase.from('tournament_rounds').delete().neq('id', ZERO)
    if (r.error) throw r.error
    const p = await supabase.from('tournament_players').delete().neq('id', ZERO)
    if (p.error) throw p.error
    const t = await supabase.from('tournaments').delete().neq('id', ZERO)
    if (t.error) throw t.error

    console.log('RESET: done')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('RESET ERROR:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
