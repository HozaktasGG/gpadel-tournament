import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export class AdminAuthError extends Error {
  status: 401 | 403
  constructor(status: 401 | 403) {
    super(status === 401 ? 'You must be signed in.' : 'Admin access required.')
    this.status = status
  }
}

// Verifies the session cookie AND profiles.is_admin. Throws AdminAuthError otherwise.
export async function requireAdmin(): Promise<{ id: string; email: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AdminAuthError(401)

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin, player_code')
    .eq('id', user.id)
    .maybeSingle<{ is_admin: boolean | null }>()

  if (!profile?.is_admin) throw new AdminAuthError(403)
  return { id: user.id, email: user.email ?? null }
}

// For Route Handlers: returns an error response when the caller is not an admin, null otherwise.
export async function adminGuard(): Promise<NextResponse | null> {
  try {
    await requireAdmin()
    return null
  } catch (e) {
    const status = e instanceof AdminAuthError ? e.status : 401
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
  }
}
