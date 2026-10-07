'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function VerifyContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    if (!token) return

    called.current = true

    fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(res => res.json())
      .then(data => {
        setStatus(data.success ? 'success' : 'error')
      })
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-6">
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

        {status === 'loading' && (
          <p className="text-sm text-subtle">Verifying your email...</p>
        )}

        {status === 'success' && (
          <div>
            <p className="text-xl font-bold text-foreground mb-3">Email Verified!</p>
            <p className="text-sm text-muted-foreground">Your registration is pending admin approval. You will be added to the participants list once approved.</p>
            <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: '#ff8a5c' }}>
              Back to Tournament Page
            </a>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p className="text-xl font-bold text-destructive mb-3">Verification Failed</p>
            <p className="text-sm text-muted-foreground">This link is invalid or has already been used.</p>
            <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: '#ff8a5c' }}>
              Back to Tournament Page
            </a>
          </div>
        )}
      </div>
    </main>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-dvh bg-background flex items-center justify-center">
        <p className="text-sm text-subtle">Loading...</p>
      </main>
    }>
      <VerifyContent />
    </Suspense>
  )
}
