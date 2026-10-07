'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthShell, Field, FormError, GoogleButton, OrDivider } from '@/components/auth/auth-shell'

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'
  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  const handleGoogle = async () => {
    setLoading(true)
    const origin = window.location.origin
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const adminRequired = searchParams.get('error') === 'admin_required'

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your SmashTorino account"
      footer={
        <>
          New to SmashTorino?{' '}
          <Link href="/signup" className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {adminRequired && <FormError className="mb-4">This area is for organizers. Sign in with an admin account.</FormError>}
      <GoogleButton onClick={handleGoogle} disabled={loading} />
      <OrDivider />
      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-10">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  )
}
