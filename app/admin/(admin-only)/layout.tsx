import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function AdminOnlyLayout({
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
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect('/admin/tournament')
  }

  return <>{children}</>
}
