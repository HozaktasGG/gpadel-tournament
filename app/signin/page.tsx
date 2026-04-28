'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'
  const supabase = createClient()

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

  return (
    <main
      className="flex-1 flex items-center justify-center py-12 px-4"
      style={{ backgroundColor: '#1a3d2e' }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          backgroundColor: '#0f2a1f',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="px-7 pt-8 pb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm text-white/60 mt-2">
            Sign in to your SmashTorino account
          </p>
        </div>
        <div className="px-7 pb-7">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-50"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.6z" />
              <path fill="#34A853" d="M9 18a8.58 8.58 0 0 0 5.96-2.18l-2.92-2.26a5.4 5.4 0 0 1-8.06-2.85H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.98 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.02-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.02 2.33A5.4 5.4 0 0 1 9 3.58z" />
            </svg>
            Sign in with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs text-white/40">or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>

            {error && (
              <p className="text-xs text-red-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
              style={{ backgroundColor: '#ff6b35' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 space-y-2 text-center">
            <Link href="/forgot-password" className="block text-xs text-white/50 hover:text-white/80">
              Forgot password?
            </Link>
            <p className="text-sm text-white/60">
              Don't have an account?{' '}
              <Link href="/signup" className="font-semibold" style={{ color: '#ff6b35' }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="flex-1" style={{ backgroundColor: '#1a3d2e' }} />}>
      <SignInContent />
    </Suspense>
  )
}
