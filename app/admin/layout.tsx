import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AdminProvider from './admin-provider'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/signin?redirect=/admin')

  const [{ data: profile }, { data: managed }] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('event_managers')
      .select('id')
      .eq('user_id', user.id)
      .limit(1),
  ])

  const isAdmin = !!profile?.is_admin
  const isManager = (managed ?? []).length > 0

  if (!isAdmin && !isManager) {
    redirect('/dashboard')
  }

  return (
    <AdminProvider password={process.env.ADMIN_PASSWORD ?? ''}>
      {children}
    </AdminProvider>
  )
}
