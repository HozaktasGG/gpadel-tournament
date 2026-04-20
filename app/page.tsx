'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const CAPACITY = 12

type Participant = {
  id: number
  first_name: string
  last_name: string
  email: string
  email_verified: boolean
  admin_approved: boolean
}

export default function Home() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [first_name, setFirstName] = useState('')
  const [last_name, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const fetchRegistrations = async () => {
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('*')
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
    <main className="min-h-screen bg-white p-6 sm:p-12">
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
          <h1 className="text-2xl font-bold text-black mb-1">GPadel Tournament</h1>
          <p className="text-sm text-gray-600 mb-1">April 24, 2026, Friday — 17:00–18:30</p>
          <p className="text-sm text-gray-600 mb-4">GPadel Cenisia</p>

          <p className="text-sm text-gray-800 mb-4">💰 Entry Fee: €17 per person</p>

          <p className="text-sm text-gray-800 mb-1">🎾 Format: Americano</p>
          <p className="text-sm text-gray-600 mb-4">In Americano format, players rotate partners and opponents each round — so you'll play with and against everyone! Points are accumulated individually throughout the tournament. It's the perfect format to meet new people and enjoy competitive padel.</p>

          <p className="text-sm text-gray-800 mb-1">🏆 Prizes:</p>
          <p className="text-sm text-gray-600 mb-8">1st Place: Surprise Prize 🎁<br/>Top players will be rewarded!</p>

          {isFull ? (
            <p className="text-sm text-gray-800 border border-gray-300 px-4 py-3 rounded">
              All spots are full. Registration is closed.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">First Name</label>
                <input
                  type="text"
                  value={first_name}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Last Name</label>
                <input
                  type="text"
                  value={last_name}
                  onChange={e => setLastName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>

              {status === 'error' && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}
              {status === 'success' && (
                <p className="text-sm text-green-600">Registration received! Please check your email to verify. After verification, admin will approve your registration.</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-2.5 text-sm font-semibold text-white rounded disabled:opacity-50"
                style={{ backgroundColor: '#ff6b35' }}
              >
                {status === 'loading' ? 'Registering...' : 'Register'}
              </button>
            </form>
          )}
        </div>

        {/* Sağ: Katılımcılar */}
        <div>
          <p className="text-sm font-medium text-black mb-4">
            Spots Left: {remaining}/{CAPACITY}
          </p>
          {participants.length === 0 ? (
            <p className="text-sm text-gray-400">No registrations yet.</p>
          ) : (
            <ol className="space-y-2">
              {participants.map((p, i) => (
                <li key={p.id} className="text-lg font-semibold text-black">
                  {i + 1}. {p.first_name} {p.last_name}
                </li>
              ))}
            </ol>
          )}
        </div>

      </div>
    </main>
  )
}
