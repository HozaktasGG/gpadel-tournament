'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import TeamRegistrationModal from '@/components/TeamRegistrationModal'

type TeamReg = {
  id: string
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
  team_name: string
  captain_id: string
}

type Props = {
  eventId: string
  eventName: string
  userId: string
  initialRegistration?: TeamReg | null
}

export default function TeamRegisterSection({
  eventId,
  eventName,
  userId,
  initialRegistration = null,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(initialRegistration === undefined)
  const [registration, setRegistration] = useState<TeamReg | null>(initialRegistration)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)

  const loadRegistration = async () => {
    const { data } = await supabase
      .from('team_registrations')
      .select('id, status, team_name, captain_id')
      .eq('event_id', eventId)
      .or(`captain_id.eq.${userId},partner_id.eq.${userId}`)
      .neq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<TeamReg>()
    setRegistration(data ?? null)
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!registration) return
    if (!confirm('Are you sure you want to cancel this team request?')) return
    setCanceling(true)
    const res = await fetch('/api/team-registration/cancel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: registration.id }),
    })
    const data = await res.json().catch(() => ({} as { error?: string }))
    setCanceling(false)
    if (!res.ok) {
      alert(data.error || 'Action failed.')
      return
    }
    router.refresh()
    loadRegistration()
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const handleSuccess = (partnerName: string) => {
    setModalOpen(false)
    setToast(`✅ Invite sent! Your registration will be confirmed once ${partnerName} accepts.`)
    loadRegistration()
    router.refresh()
  }

  const toastEl = toast ? (
    <div
      className="fixed top-0 left-0 right-0 z-[60] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
      style={{ backgroundColor: '#22c55e' }}
      role="status"
      aria-live="polite"
    >
      {toast}
    </div>
  ) : null

  if (loading) {
    return (
      <>
        {toastEl}
        <div className="mt-6 flex items-center justify-center py-4">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: '#2d5a40', borderTopColor: '#ff6b35' }}
          />
        </div>
      </>
    )
  }

  if (registration) {
    const statusConfig = {
      pending_partner: {
        emoji: '⏳',
        text: 'Waiting for partner approval',
        bg: 'rgba(234,179,8,0.12)',
        border: 'rgba(234,179,8,0.35)',
        color: '#eab308',
      },
      pending_approval: {
        emoji: '⏳',
        text: 'Waiting for admin approval',
        bg: 'rgba(59,130,246,0.12)',
        border: 'rgba(59,130,246,0.35)',
        color: '#3b82f6',
      },
      approved: {
        emoji: '✅',
        text: 'Registered',
        bg: 'rgba(34,197,94,0.12)',
        border: 'rgba(34,197,94,0.35)',
        color: '#22c55e',
      },
      rejected: {
        emoji: '❌',
        text: 'Registration rejected',
        bg: 'rgba(239,68,68,0.12)',
        border: 'rgba(239,68,68,0.35)',
        color: '#f87171',
      },
    }[registration.status]

    const isCaptain = registration.captain_id === userId
    const canCancel =
      isCaptain &&
      (registration.status === 'pending_partner' || registration.status === 'pending_approval')

    return (
      <>
        {toastEl}
        <div className="mt-6">
          <div
            className="rounded-xl px-4 py-4"
            style={{ backgroundColor: statusConfig.bg, border: `1px solid ${statusConfig.border}` }}
          >
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <p className="text-sm font-bold" style={{ color: statusConfig.color }}>
                {statusConfig.emoji} {statusConfig.text}
              </p>
              {canCancel && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={canceling}
                  className="border border-red-500 text-red-400 text-xs px-3 py-1 rounded-lg hover:bg-red-500/10 transition disabled:opacity-50"
                >
                  {canceling ? '...' : '🗑 Cancel Request'}
                </button>
              )}
            </div>
            <p className="text-xs text-white/70 mt-2 text-center">
              Team: <span className="font-bold text-white">{registration.team_name}</span>
            </p>
          </div>

          {registration.status === 'rejected' && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-3 w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: '#ff6b35' }}
            >
              🎾 Register Again
            </button>
          )}

          {modalOpen && (
            <TeamRegistrationModal
              eventId={eventId}
              eventName={eventName}
              onClose={() => setModalOpen(false)}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {toastEl}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full bg-[#ff6b35] text-white font-bold rounded-xl px-6 py-3 transition hover:brightness-110"
        >
          🎾 Register as a Team
        </button>

        {modalOpen && (
          <TeamRegistrationModal
            eventId={eventId}
            eventName={eventName}
            onClose={() => setModalOpen(false)}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </>
  )
}
