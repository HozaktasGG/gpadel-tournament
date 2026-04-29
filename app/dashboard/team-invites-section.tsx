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
        width={40}
        height={40}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: 40, height: 40 }}
      />
    )
  }
  const initial = (name[0] ?? '?').toUpperCase()
  return (
    <span
      className="flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold text-white bg-[#ff6b35]"
      style={{ width: 40, height: 40 }}
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

  useEffect(() => {
    let cancelled = false
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

      if (cancelled) return

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
    load()
    return () => { cancelled = true }
  }, [userId, supabase])

  const handleCancel = async (id: string) => {
    if (!confirm('Bu takım davetini geri çekmek istediğinize emin misiniz?')) return
    setActionId(id)
    const res = await fetch('/api/team-registration/cancel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: id }),
    })
    const data = await res.json().catch(() => ({} as { error?: string }))
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
    const data = await res.json().catch(() => ({} as { error?: string }))
    setActionId(null)
    if (!res.ok) {
      alert(data.error || 'İşlem başarısız.')
      return
    }
    setReceived(prev => prev.filter(r => r.id !== id))
  }

  const totalCount = sent.length + received.length

  return (
    <section className="mt-10">
      <h2 className="text-white font-bold text-lg mb-3">🎾 Takım Davetlerim</h2>

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-4">Yükleniyor...</p>
      ) : totalCount === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">Bekleyen davet yok</p>
      ) : (
        <>
          {received.map(inv => {
            const captainName = fullName(inv.captain, 'Bir oyuncu')
            const isActing = actionId === inv.id
            return (
              <div
                key={inv.id}
                className="bg-[#0f2318] border border-[#2d5a40] rounded-xl p-4 mb-3"
              >
                <div className="flex items-start gap-3">
                  <Avatar profile={inv.captain} name={captainName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-bold">{captainName}</span>
                      <span className="text-white/70"> seni </span>
                      <span className="font-bold text-[#ff6b35]">{inv.team_name}</span>
                      <span className="text-white/70"> takımına davet etti</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-1 truncate">
                      {inv.event?.name ?? '—'}
                      {inv.event?.date && ` · ${formatDate(inv.event.date)}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleRespond(inv.id, 'accept')}
                    disabled={isActing}
                    className="flex-1 bg-green-500 hover:bg-green-600 transition text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50"
                  >
                    {isActing ? '...' : '✅ Kabul Et'}
                  </button>
                  <button
                    onClick={() => handleRespond(inv.id, 'reject')}
                    disabled={isActing}
                    className="flex-1 border border-red-500 text-red-400 hover:bg-red-500/10 transition text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50"
                  >
                    {isActing ? '...' : '❌ Reddet'}
                  </button>
                </div>
              </div>
            )
          })}

          {sent.map(inv => {
            const partnerName = fullName(inv.partner, 'Partner')
            const isActing = actionId === inv.id
            const badge = inv.status === 'pending_partner'
              ? { text: '⏳ Partner onayı bekleniyor', bg: 'bg-yellow-500/15', color: 'text-yellow-400' }
              : { text: '🔵 Admin onayı bekleniyor',   bg: 'bg-blue-500/15',   color: 'text-blue-400' }
            return (
              <div
                key={inv.id}
                className="bg-[#0f2318] border border-[#2d5a40] rounded-xl p-4 mb-3"
              >
                <div className="flex items-start gap-3">
                  <Avatar profile={inv.partner} name={partnerName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#ff6b35] truncate">
                      {inv.team_name}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      <span className="text-white/60">Partner:</span> {partnerName}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      {inv.event?.name ?? '—'}
                      {inv.event?.date && ` · ${formatDate(inv.event.date)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${badge.bg} ${badge.color}`}>
                    {badge.text}
                  </span>
                  <button
                    onClick={() => handleCancel(inv.id)}
                    disabled={isActing}
                    className="border border-red-500 text-red-400 hover:bg-red-500/10 transition text-sm font-semibold px-3 py-1 rounded-lg disabled:opacity-50"
                  >
                    {isActing ? '...' : '🗑 Geri Çek'}
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}
