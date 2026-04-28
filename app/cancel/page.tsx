'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function CancelContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'deadline'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const checked = useRef(false)

  // April 24, 2026 17:00 CET
  const TOURNAMENT_DATE = new Date('2026-04-24T15:00:00Z')

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    if (!token) {
      setStatus('error')
      setErrorMsg('Invalid cancellation link.')
      return
    }

    const now = new Date()
    const hoursLeft = (TOURNAMENT_DATE.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hoursLeft < 24) {
      setStatus('deadline')
    }
  }, [token])

  const handleCancel = async () => {
    setStatus('loading')
    const res = await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (!res.ok) {
      setStatus(res.status === 403 ? 'deadline' : 'error')
      setErrorMsg(data.error ?? 'Something went wrong.')
    } else {
      setStatus('success')
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8">
          <img
            src="/smashpadel_logo.png"
            alt="Smash Padel"
            width={100}
            height={100}
            className="rounded-full"
          />
        </div>

        {status === 'idle' && token && (
          <div>
            <p className="text-xl font-bold text-black mb-3">Cancel Registration</p>
            <p className="text-sm text-gray-600 mb-8">Are you sure you want to cancel your registration for the GPadel Tournament?</p>
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 text-sm font-semibold text-white rounded"
              style={{ backgroundColor: '#dc2626' }}
            >
              Yes, Cancel My Registration
            </button>
            <div className="mt-4">
              <a href="/" className="text-sm text-gray-500 underline">Keep my registration</a>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <p className="text-sm text-gray-500">Cancelling your registration...</p>
        )}

        {status === 'success' && (
          <div>
            <p className="text-xl font-bold text-black mb-3">Registration Cancelled</p>
            <p className="text-sm text-gray-600">Your registration has been cancelled successfully.</p>
            <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: '#ff6b35' }}>
              Back to Tournament Page
            </a>
          </div>
        )}

        {status === 'deadline' && (
          <div>
            <p className="text-xl font-bold text-black mb-3">Cancellation Unavailable</p>
            <p className="text-sm text-gray-600">Cancellation is no longer available. You can only cancel up to 24 hours before the tournament.</p>
            <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: '#ff6b35' }}>
              Back to Tournament Page
            </a>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p className="text-xl font-bold text-red-600 mb-3">Error</p>
            <p className="text-sm text-gray-600">{errorMsg || 'Invalid or expired cancellation link.'}</p>
            <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: '#ff6b35' }}>
              Back to Tournament Page
            </a>
          </div>
        )}
      </div>
    </main>
  )
}

export default function CancelPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    }>
      <CancelContent />
    </Suspense>
  )
}
