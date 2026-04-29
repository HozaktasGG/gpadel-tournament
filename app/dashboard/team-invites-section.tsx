'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type ProfileEmbed = {
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

type EventEmbed = {
  name: string | null
  date: string | null
}

type SentInvite = {
  id: string
  team_name: string
  status: 'pending_partner' | 'pending_approval'
  created_at: string
  event: EventEmbed | null
  partner: ProfileEmbed | null
}

type ReceivedInvite = {
  id: string
  team_name: string
  status: 'pending_partner'
  created_at: string
  event: EventEmbed | null
  captain: ProfileEmbed | null
}

type SentInviteRaw = Omit<SentInvite, 'event' | 'partner'> & {
  event: EventEmbed | EventEmbed[] | null
  partner: ProfileEmbed | ProfileEmbed[] | null
}

type ReceivedInviteRaw = Omit<ReceivedInvite, 'event' | 'captain'> & {
  event: EventEmbed | EventEmbed[] | null
  captain: ProfileEmbed | ProfileEmbed[] | null
}

function unwrapOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function fullName(p: ProfileEmbed | null, fallback = 'Oyuncu'): string {
  if (!p) return fallback
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || fallback
}

function Avatar({ profile, name }: { profile: ProfileEmbed | null; name: string }) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        width={36}
        height={36}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: 36, height: 36 }}
      />
    )
  }
  const initial = (name[0] ?? '?').toUpperCase()
  return (
    <span
      className="flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ width: 36, height: 36, backgroundColor: '#ff6b35' }}
    >
      {initial}
    </span>
  )
}

export default function TeamInvitesSection({ userId }: { userId: string }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState<SentInvite[]>([])
  const [received, setReceived] = useState<ReceivedInvite[]>([])
  const [actionId, setActionId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [{ data: sentData }, { data: receivedData }] = await Promise.all([
      supabase
        .from('team_registrations')
        .select(
          'id, team_name, status, created_at, event:events(name, date), partner:profiles!team_registrations_partner_id_fkey(first_name, last_name, avatar_url)'
        )
        .eq('captain_id', userId)
        .in('status', ['pending_partner', 'pending_approval'])
        .order('created_at', { ascending: false }),
      supabase
        .from('team_registrations')
        .select(
          'id, team_name, status, created_at, event:events(name, date), captain:profiles!team_registrations_captain_id_fkey(first_name, last_name, avatar_url)'
        )
        .eq('partner_id', userId)
        .eq('status', 'pending_partner')
        .order('created_at', { ascending: false }),
    ])

    const sentRows = ((sentData ?? []) as unknown as SentInviteRaw[]).map<SentInvite>(r => ({
      id: r.id,
      team_name: r.team_name,
      status: r.status,
      created_at: r.created_at,
      event: unwrapOne(r.event),
      partner: unwrapOne(r.partner),
    }))
    const receivedRows = ((receivedData ?? []) as unknown as ReceivedInviteRaw[]).map<ReceivedInvite>(r => ({
      id: r.id,
      team_name: r.team_name,
      status: r.status,
      created_at: r.created_at,
      event: unwrapOne(r.event),
      captain: unwrapOne(r.captain),
    }))

    setSent(sentRows)
    setReceived(receivedRows)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const handleCancel = async (id: string) => {
    if (!confirm('Bu takım davetini geri çekmek istediğinize emin misiniz?')) return
    setActionId(id)
    const res = await fetch('/api/team-registration/cancel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: id }),
    })
    const data = await res.json().catch(() => ({}))
    setActionId(null)
    if (!res.ok) {
      alert(data.error || 'İşlem başarısız.')
      return
    }
    setSent(prev => prev.filter(s => s.id !== id))
  }

  const handleRespond = async (id: string, action: 'accept' | 'reject') => {
    setActionId(id)
    const res = await fetch('/api/team-registration/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: id, action }),
    })
    const data = await res.json().catch(() => ({}))
    setActionId(null)
    if (!res.ok) {
      alert(data.error || 'İşlem başarısız.')
      return
    }
    setReceived(prev => prev.filter(r => r.id !== id))
  }

  const sentBadge = (status: SentInvite['status']) => {
    const cfg = status === 'pending_partner'
      ? { text: '🟡 Partner onayı bekleniyor', bg: 'rgba(234,179,8,0.15)', color: '#eab308' }
      : { text: '🔵 Admin onayı bekleniyor',   bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {cfg.text}
      </span>
    )
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-white mb-4">🎾 Takım Davetlerim</h2>

      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: '#0f2318', border: '1px solid #2d5a40' }}
      >
        {loading ? (
          <p className="text-sm text-gray-400">Yükleniyor...</p>
        ) : sent.length === 0 && received.length === 0 ? (
          <p className="text-sm text-gray-400">Bekleyen davet yok</p>
        ) : (
          <div className="space-y-5">
            {received.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
                  Gelen Davetler
                </h3>
                <div className="space-y-3">
                  {received.map(inv => {
                    const captainName = fullName(inv.captain, 'Bir oyuncu')
                    const isActing = actionId === inv.id
                    return (
                      <div
                        key={inv.id}
                        className="rounded-xl p-4"
                        style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar profile={inv.captain} name={captainName} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">
                              <span className="font-bold">{captainName}</span>
                              <span className="text-white/70"> seni </span>
                              <span className="font-bold" style={{ color: '#ff6b35' }}>{inv.team_name}</span>
                              <span className="text-white/70"> takımına davet etti</span>
                            </p>
                            <p className="text-xs text-white/50 mt-1 truncate">
                              {inv.event?.name ?? '—'}
                              {inv.event?.date && ` · ${formatDate(inv.event.date)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleRespond(inv.id, 'accept')}
                            disabled={isActing}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                            style={{ backgroundColor: '#22c55e' }}
                          >
                            {isActing ? '...' : '✅ Kabul Et'}
                          </button>
                          <button
                            onClick={() => handleRespond(inv.id, 'reject')}
                            disabled={isActing}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                            style={{ backgroundColor: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                          >
                            {isActing ? '...' : '❌ Reddet'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {sent.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
                  Gönderdiğim Davetler
                </h3>
                <div className="space-y-3">
                  {sent.map(inv => {
                    const partnerName = fullName(inv.partner, 'Partner')
                    const isActing = actionId === inv.id
                    return (
                      <div
                        key={inv.id}
                        className="rounded-xl p-4"
                        style={{ backgroundColor: '#1a3d2e', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar profile={inv.partner} name={partnerName} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: '#ff6b35' }}>
                              {inv.team_name}
                            </p>
                            <p className="text-xs text-white/70 mt-0.5 truncate">
                              <span className="text-white/50">Partner:</span> {partnerName}
                            </p>
                            <p className="text-xs text-white/50 mt-0.5 truncate">
                              {inv.event?.name ?? '—'}
                              {inv.event?.date && ` · ${formatDate(inv.event.date)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-3">
                          {sentBadge(inv.status)}
                          <button
                            onClick={() => handleCancel(inv.id)}
                            disabled={isActing}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50"
                            style={{ backgroundColor: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                          >
                            {isActing ? '...' : '🗑 İsteği Geri Çek'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
