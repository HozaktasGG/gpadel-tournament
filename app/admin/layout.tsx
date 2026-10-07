import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, player_code')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect('/signin?error=admin_required&redirect=/admin')
  }

  return <>{children}</>
}
