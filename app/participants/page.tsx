'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Participant = {
  id: string
  first_name: string
  last_name: string
}

function ParticipantsContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    if (!token) {
      setStatus('error')
      setErrorMsg('Invalid link. Only registered participants can view this page.')
      return
    }

    fetch(`/api/participants?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setStatus('error')
          setErrorMsg(data.error)
        } else {
          setParticipants(data.data)
          setStatus('success')
        }
      })
      .catch(() => {
        setStatus('error')
        setErrorMsg('Something went wrong. Please try again.')
      })
  }, [token])

  return (
    <main className="min-h-screen bg-white p-6 sm:p-12">
      <div className="max-w-md mx-auto">
        <div className="flex justify-center mb-10">
          <img
            src="/smashpadel_logo.png"
            alt="Smash Padel"
            width={100}
            height={100}
            className="rounded-full"
          />
        </div>

        {status === 'loading' && (
          <p className="text-sm text-gray-500 text-center">Loading participants...</p>
        )}

        {status === 'error' && (
          <div className="text-center">
            <p className="text-sm text-gray-700">{errorMsg}</p>
            <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: '#ff6b35' }}>
              Back to Tournament Page
            </a>
          </div>
        )}

        {status === 'success' && (
          <div>
            <h1 className="text-2xl font-bold text-black mb-1">Participants</h1>
            <p className="text-sm text-gray-500 mb-6">GPadel Tournament — April 24, 2026</p>
            <ol className="space-y-2">
              {participants.map((p, i) => (
                <li key={p.id} className="text-base font-semibold text-black">
                  {i + 1}. {p.first_name} {p.last_name}
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <a href="/" className="text-sm text-gray-400 underline">Back to Tournament Page</a>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function ParticipantsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    }>
      <ParticipantsContent />
    </Suspense>
  )
}
