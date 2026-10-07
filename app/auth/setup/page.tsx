'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthShell, Field, FormError } from '@/components/auth/auth-shell'

export default function AuthSetupPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/signin')
        return
      }
      setEmail(data.user.email ?? '')
      setChecking(false)
    })
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({
      password: newPassword,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  if (checking) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-10" aria-busy="true">
        <p className="sr-only">Preparing your account…</p>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </main>
    )
  }

  return (
    <AuthShell title="Welcome to SmashTorino" subtitle={`Set a password to finish setting up ${email}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New password" htmlFor="new-password">
          <Input id="new-password" type="password" autoComplete="new-password" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <p className="text-xs text-subtle">At least 6 characters.</p>
        </Field>
        <Field label="Confirm password" htmlFor="confirm-password">
          <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </AuthShell>
  )
}
