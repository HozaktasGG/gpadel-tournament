'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function AuthSetupPage() {
  const supabase = createClient()
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
      <main
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: '#1a3d2e' }}
      >
        <p className="text-sm text-white/70">Preparing your account...</p>
      </main>
    )
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
        <div className="px-7 pt-8 pb-4 text-center">
          <div className="text-3xl mb-2">🎾</div>
          <h1 className="text-2xl font-bold text-white">
            Welcome to SmashTorino
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Set a password to finish setting up <span className="text-white">{email}</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="px-7 pb-7 pt-2 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
            <p className="text-[11px] text-white/40 mt-1">At least 6 characters.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          </div>

          {error && <p className="text-xs text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
            style={{ backgroundColor: '#ff6b35' }}
          >
            {saving ? 'Setting up...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </main>
  )
}
