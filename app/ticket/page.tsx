'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Ticket = {
  id: string
  firstName: string
  lastName: string
  email: string
  checkedIn: boolean
  event: string
  date: string
  dateLabel: string
  time: string
  venue: string
  qr: string
}

function TicketContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [saveHelpOpen, setSaveHelpOpen] = useState(false)
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    if (!token) {
      setStatus('error')
      setErrorMsg('Invalid link. This ticket does not exist.')
      return
    }

    fetch(`/api/ticket?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setStatus('error')
          setErrorMsg(data.error)
        } else {
          setTicket(data)
          setStatus('success')
        }
      })
      .catch(() => {
        setStatus('error')
        setErrorMsg('Something went wrong. Please try again.')
      })
  }, [token])

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1a3d2e' }}>
        <p className="text-sm text-white/70">Loading ticket...</p>
      </main>
    )
  }

  if (status === 'error' || !ticket) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#1a3d2e' }}>
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-8">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={80} height={80} className="rounded-full" />
          </div>
          <p className="text-xl font-bold text-white mb-3">Ticket Not Available</p>
          <p className="text-sm text-white/70">{errorMsg}</p>
          <a href="/" className="inline-block mt-6 text-sm font-semibold" style={{ color: '#ff6b35' }}>
            Back to Tournament Page
          </a>
        </div>
      </main>
    )
  }

  const walletUrl = `/api/wallet?token=${ticket.id}`
  const showSaveHelp = () => setSaveHelpOpen(true)

  return (
    <main className="min-h-screen py-8 px-4 sm:py-12" style={{ backgroundColor: '#1a3d2e' }}>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/smashpadel_logo.png"
            alt="Smash Padel"
            width={72}
            height={72}
            className="rounded-full mb-3"
          />
          <p className="text-xs tracking-[0.3em] uppercase text-white/60">SmashTorino</p>
        </div>

        {/* Ticket card */}
        <div
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Top banner */}
          <div className="px-6 pt-7 pb-6 text-center" style={{ background: 'linear-gradient(180deg, #204a38 0%, #0f2a1f 100%)' }}>
            <p className="text-xs tracking-[0.25em] uppercase font-semibold" style={{ color: '#ff6b35' }}>Event Ticket</p>
            <h1 className="text-2xl font-bold text-white mt-2">GPadel Tournament</h1>
            {ticket.checkedIn && (
              <div className="mt-3 inline-block px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#ff6b35', color: '#fff' }}>
                ✓ Checked In
              </div>
            )}
          </div>

          {/* Name */}
          <div className="px-6 py-5 text-center border-t border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-xs tracking-[0.2em] uppercase text-white/50 mb-1">Attendee</p>
            <p className="text-xl font-bold text-white">{ticket.firstName} {ticket.lastName}</p>
          </div>

          {/* Event details */}
          <div className="px-6 py-5 space-y-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <span className="text-lg">📅</span>
              <p className="text-sm text-white">{ticket.dateLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">🕐</span>
              <p className="text-sm text-white">{ticket.time}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">📍</span>
              <p className="text-sm text-white">{ticket.venue}</p>
            </div>
          </div>

          {/* Perforated divider */}
          <div className="relative h-6" style={{ backgroundColor: '#0f2a1f' }}>
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ backgroundColor: '#1a3d2e' }}></div>
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ backgroundColor: '#1a3d2e' }}></div>
            <div
              className="absolute left-6 right-6 top-1/2 -translate-y-1/2 border-t border-dashed"
              style={{ borderColor: 'rgba(255,255,255,0.2)' }}
            ></div>
          </div>

          {/* QR code */}
          <div className="px-6 py-6 bg-white flex flex-col items-center">
            <img
              src={ticket.qr}
              alt="Ticket QR code"
              className="w-56 h-56 sm:w-64 sm:h-64"
              style={{ imageRendering: 'pixelated' }}
            />
            <p className="mt-4 text-xs font-medium text-gray-600 text-center">
              Show this QR code at the entrance
            </p>
            <p className="mt-1 text-[10px] tracking-[0.2em] uppercase text-gray-400">
              ID: {ticket.id}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 space-y-3">
          <a
            href={walletUrl}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#ff6b35' }}
          >
            <span style={{ fontSize: 16 }}>📅</span>
            Add to Calendar
          </a>
          <button
            onClick={showSaveHelp}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <span style={{ fontSize: 16 }}>📱</span>
            Save Ticket
          </button>
        </div>

        {saveHelpOpen && (
          <div
            onClick={() => setSaveHelpOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="max-w-sm w-full rounded-2xl p-6 text-center"
              style={{ backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div className="text-3xl mb-3">📱</div>
              <h3 className="text-lg font-bold text-white mb-2">Save Your Ticket</h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Take a screenshot of this ticket or bookmark this page so you can show your QR code
                at the entrance.
              </p>
              <button
                onClick={() => setSaveHelpOpen(false)}
                className="mt-5 w-full py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#ff6b35' }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-white/50 underline">Back to Tournament Page</a>
        </div>
      </div>
    </main>
  )
}

export default function TicketPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1a3d2e' }}>
          <p className="text-sm text-white/70">Loading...</p>
        </main>
      }
    >
      <TicketContent />
    </Suspense>
  )
}
