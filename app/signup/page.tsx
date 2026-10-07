'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthShell, Field, FormError, GoogleButton, OrDivider } from '@/components/auth/auth-shell'

export default function SignUpPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) {
        router.replace('/dashboard')
      }
    })
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    })
    if (err) {
      setLoading(false)
      setError(err.message)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  const handleGoogle = async () => {
    setLoading(true)
    const origin = window.location.origin
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback?next=/dashboard` },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join the SmashTorino community"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/signin" className="font-semibold text-primary-text underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogle} disabled={loading} label="Sign up with Google" />
      <OrDivider />
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="first-name">
            <Input id="first-name" autoComplete="given-name" required value={firstName} onChange={e => setFirstName(e.target.value)} />
          </Field>
          <Field label="Last name" htmlFor="last-name">
            <Input id="last-name" autoComplete="family-name" required value={lastName} onChange={e => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          <p className="text-xs text-subtle">At least 6 characters</p>
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}
