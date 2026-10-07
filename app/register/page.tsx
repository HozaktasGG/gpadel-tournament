'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const CAPACITY = 12

type Participant = {
  id: number
}

export default function RegisterPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [first_name, setFirstName] = useState('')
  const [last_name, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  const fetchRegistrations = async () => {
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('id')
      .eq('email_verified', true)
      .eq('admin_approved', true)
      .order('created_at', { ascending: true })
    if (error) console.error('Fetch error:', error)
    if (data) setParticipants(data)
  }

  useEffect(() => {
    fetchRegistrations()

    const channel = supabase
      .channel('tournament')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_registrations' }, () => {
        fetchRegistrations()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, last_name, email }),
    })

    const data = await res.json()

    if (!res.ok) {
      setStatus('error')
      setErrorMsg(data.error ?? 'An error occurred. Please try again.')
    } else {
      setStatus('success')
      setFirstName('')
      setLastName('')
      setEmail('')
    }
  }

  const isFull = participants.length >= CAPACITY
  const remaining = CAPACITY - participants.length

  return (
    <main className="min-h-dvh bg-background p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-center mb-10">
          <img
            src="/smashpadel_logo.png"
            alt="Smash Padel"
            width={120}
            height={120}
            className="rounded-full"
          />
        </div>
      </div>
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">

        {/* Sol: Form */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">GPadel Tournament</h1>
          <p className="text-sm text-muted-foreground mb-1">April 24, 2026, Friday — 17:00–18:30</p>
          <p className="text-sm text-muted-foreground mb-4">GPadel Cenisia</p>

          <p className="text-sm text-foreground mb-4">💰 Entry Fee: €17 per person</p>

          <p className="text-sm text-foreground mb-1">🎾 Format: Americano</p>
          <p className="text-sm text-muted-foreground mb-4">In Americano format, players rotate partners and opponents each round — so you'll play with and against everyone! Points are accumulated individually throughout the tournament. It's the perfect format to meet new people and enjoy competitive padel.</p>

          <p className="text-sm text-foreground mb-1">🏆 Prizes:</p>
          <p className="text-sm text-muted-foreground mb-8">1st Place: Surprise Prize 🎁<br/>Top players will be rewarded!</p>

          {isFull ? (
            <p className="text-sm text-foreground border border-border-strong px-4 py-3 rounded">
              All spots are full. Registration is closed.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">First Name</label>
                <input
                  type="text"
                  value={first_name}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className="w-full border border-border-strong rounded px-3 py-2 text-sm outline-none focus:border-border-strong"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Last Name</label>
                <input
                  type="text"
                  value={last_name}
                  onChange={e => setLastName(e.target.value)}
                  required
                  className="w-full border border-border-strong rounded px-3 py-2 text-sm outline-none focus:border-border-strong"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full border border-border-strong rounded px-3 py-2 text-sm outline-none focus:border-border-strong"
                />
              </div>

              {status === 'error' && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
              {status === 'success' && (
                <p className="text-sm text-success">Registration received! Please check your email to verify. After verification, admin will approve your registration.</p>
              )}

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="privacy"
                  checked={privacyAccepted}
                  onChange={e => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <label htmlFor="privacy" className="text-sm text-foreground/85 cursor-pointer">
                  I agree to the{' '}
                  <a href="/privacy" className="underline text-foreground" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                  <span className="block text-xs text-subtle mt-0.5">You can cancel your registration up to 24 hours before the tournament.</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={status === 'loading' || !privacyAccepted}
                className="w-full py-2.5 text-sm font-semibold text-primary-foreground rounded disabled:opacity-50"
                style={{ backgroundColor: '#ff6b35' }}
              >
                {status === 'loading' ? 'Registering...' : 'Register'}
              </button>
            </form>
          )}
        </div>

        {/* Sağ: Spot sayacı */}
        <div>
          <p className="text-5xl font-bold text-foreground">
            {participants.length} / {CAPACITY}
          </p>
          <p className="text-base text-subtle mt-1">Spots Filled</p>
        </div>

      </div>
    </main>
  )
}
