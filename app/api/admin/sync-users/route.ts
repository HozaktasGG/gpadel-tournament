import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ProfileRow = {
  id: string
  first_name: string | null
}

function pickName(meta: Record<string, unknown> | null | undefined, email: string | null): string {
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name : null
  const name = typeof meta?.name === 'string' ? meta.name : null
  return (fullName || name || email || '').trim()
}

function splitName(raw: string): { first: string; last: string } {
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export async function POST(req: NextRequest) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const allAuthUsers: { id: string; email: string | null; user_metadata: Record<string, unknown> | null }[] = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      return NextResponse.json({ error: 'Failed to list users: ' + error.message }, { status: 500 })
    }
    const batch = data.users ?? []
    for (const u of batch) {
      allAuthUsers.push({
        id: u.id,
        email: u.email ?? null,
        user_metadata: (u.user_metadata as Record<string, unknown> | null) ?? null,
      })
    }
    if (batch.length < perPage) break
    page++
  }

  const { data: existingProfiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name')

  if (profErr) {
    return NextResponse.json({ error: 'Failed to load profiles: ' + profErr.message }, { status: 500 })
  }

  const profileMap = new Map<string, ProfileRow>()
  for (const p of (existingProfiles ?? []) as ProfileRow[]) {
    profileMap.set(p.id, p)
  }

  const toInsert: { id: string; email: string | null; first_name: string; last_name: string }[] = []
  const toUpdate: { id: string; first_name: string; last_name: string }[] = []

  for (const user of allAuthUsers) {
    const fullName = pickName(user.user_metadata, user.email)
    const { first, last } = splitName(fullName)
    const existing = profileMap.get(user.id)

    if (!existing) {
      toInsert.push({
        id: user.id,
        email: user.email,
        first_name: first,
        last_name: last,
      })
    } else if (
      (!existing.first_name || existing.first_name.trim() === '') &&
      first.length > 0
    ) {
      toUpdate.push({ id: user.id, first_name: first, last_name: last })
    }
  }

  let synced = 0
  if (toInsert.length > 0) {
    const { error: insertErr, count } = await supabaseAdmin
      .from('profiles')
      .insert(toInsert, { count: 'exact' })
    if (insertErr) {
      return NextResponse.json({ error: 'Insert failed: ' + insertErr.message }, { status: 500 })
    }
    synced = count ?? toInsert.length
  }

  let updated = 0
  for (const u of toUpdate) {
    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({ first_name: u.first_name, last_name: u.last_name })
      .eq('id', u.id)
    if (!updErr) updated++
  }

  return NextResponse.json({ synced, updated })
}
