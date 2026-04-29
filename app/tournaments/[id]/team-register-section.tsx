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
}

export default function TeamRegisterSection({ eventId, eventName, userId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [registration, setRegistration] = useState<TeamReg | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
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
    if (!confirm('Bu takım davetini geri çekmek istediğinize emin misiniz?')) return
    setCanceling(true)
    const res = await fetch('/api/team-registration/cancel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: registration.id }),
    })
    const data = await res.json().catch(() => ({}))
    setCanceling(false)
    if (!res.ok) {
      alert(data.error || 'İşlem başarısız.')
      return
    }
    router.refresh()
    loadRegistration()
  }

  useEffect(() => {
    loadRegistration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, userId])

  const handleSuccess = (_partnerName: string) => {
    setModalOpen(false)
    setSuccessMsg('Davet gönderildi! Partneriniz onayladıktan sonra admin onayına geçecek.')
    loadRegistration()
    router.refresh()
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-4">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: '#2d5a40', borderTopColor: '#ff6b35' }}
        />
      </div>
    )
  }

  if (registration) {
    const statusConfig = {
      pending_partner: {
        emoji: '⏳',
        text: 'Partner onayı bekleniyor',
        bg: 'rgba(234,179,8,0.12)',
        border: 'rgba(234,179,8,0.35)',
        color: '#eab308',
      },
      pending_approval: {
        emoji: '⏳',
        text: 'Admin onayı bekleniyor',
        bg: 'rgba(59,130,246,0.12)',
        border: 'rgba(59,130,246,0.35)',
        color: '#3b82f6',
      },
      approved: {
        emoji: '✅',
        text: 'Kayıtlısınız',
        bg: 'rgba(34,197,94,0.12)',
        border: 'rgba(34,197,94,0.35)',
        color: '#22c55e',
      },
      rejected: {
        emoji: '❌',
        text: 'Kayıt reddedildi',
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
      <div className="mt-6">
        <div
          className="rounded-xl px-4 py-4 text-center"
          style={{ backgroundColor: statusConfig.bg, border: `1px solid ${statusConfig.border}` }}
        >
          <p className="text-sm font-bold" style={{ color: statusConfig.color }}>
            {statusConfig.emoji} {statusConfig.text}
          </p>
          <p className="text-xs text-white/70 mt-1">
            Takım: <span className="font-bold text-white">{registration.team_name}</span>
          </p>
          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={canceling}
              className="mt-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
            >
              {canceling ? '...' : '🗑 Geri Çek'}
            </button>
          )}
        </div>

        {registration.status === 'rejected' && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3 w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: '#ff6b35' }}
          >
            🎾 Tekrar Kayıt Ol
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
    )
  }

  return (
    <div className="mt-6">
      {successMsg && (
        <div
          className="rounded-xl px-4 py-3 mb-3 text-center"
          style={{
            backgroundColor: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.35)',
          }}
        >
          <p className="text-sm font-semibold text-green-300">{successMsg}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full bg-[#ff6b35] text-white font-bold rounded-xl px-6 py-3 transition hover:brightness-110"
      >
        🎾 Takım Olarak Kayıt Ol
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
  )
}
