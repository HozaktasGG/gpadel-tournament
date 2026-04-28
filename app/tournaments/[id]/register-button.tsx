'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function RegisterButton({
  eventId,
  isRegistered,
  registrationId,
  isFull,
}: {
  eventId: string
  isRegistered: boolean
  registrationId: string | null
  isFull: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async () => {
    setLoading(true)
    setError('')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be signed in.')
      setLoading(false)
      return
    }

    const { error: err } = await supabase
      .from('event_registrations')
      .upsert(
        { event_id: eventId, user_id: user.id, status: 'approved' },
        { onConflict: 'event_id,user_id' }
      )
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    router.refresh()
  }

  const handleCancel = async () => {
    if (!registrationId) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase
      .from('event_registrations')
      .delete()
      .eq('id', registrationId)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    router.refresh()
  }

  if (isRegistered) {
    return (
      <div className="space-y-3">
        <div
          className="rounded-xl p-4 text-center"
          style={{
            backgroundColor: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>
            ✓ You're registered
          </p>
          <p className="text-xs text-white/60 mt-1">
            We'll send confirmation details closer to the event.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {loading ? 'Cancelling...' : 'Cancel registration'}
        </button>
        {error && <p className="text-xs text-red-300 text-center">{error}</p>}
      </div>
    )
  }

  if (isFull) {
    return (
      <div
        className="rounded-xl p-4 text-center"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <p className="text-sm text-white/70">
          This tournament is full. Check back for the next one.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleRegister}
        disabled={loading}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
        style={{ backgroundColor: '#ff6b35' }}
      >
        {loading ? 'Registering...' : 'Register for this tournament'}
      </button>
      {error && <p className="text-xs text-red-300 text-center">{error}</p>}
    </div>
  )
}
