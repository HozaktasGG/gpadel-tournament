import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function checkPassword(body: { password?: string }) {
  return body.password === process.env.ADMIN_PASSWORD
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!checkPassword(body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [
    { data: { users: authUsers } },
    { data: profiles },
    { data: eventRegs },
  ] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('profiles').select('id, first_name, last_name, phone, skill_score, quiz_completed_at'),
    supabaseAdmin.from('event_registrations').select('user_id'),
  ])

  const regCountByUser: Record<string, number> = {}
  for (const reg of eventRegs ?? []) {
    regCountByUser[reg.user_id] = (regCountByUser[reg.user_id] ?? 0) + 1
  }

  const profileMap: Record<string, NonNullable<typeof profiles>[0]> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = p
  }

  const users = authUsers.map(u => {
    const p = profileMap[u.id]
    return {
      id: u.id,
      email: u.email ?? '',
      first_name: p?.first_name ?? '',
      last_name: p?.last_name ?? '',
      phone: p?.phone ?? '',
      skill_score: p?.skill_score ?? null,
      quiz_completed_at: p?.quiz_completed_at ?? null,
      event_count: regCountByUser[u.id] ?? 0,
      created_at: u.created_at,
    }
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ data: users })
}
