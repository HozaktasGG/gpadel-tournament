'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

type EventRow = {
  id: string
  name: string | null
  date: string | null
}

type SentInvite = {
  id: string
  team_name: string
  status: 'pending_partner' | 'pending_approval'
  created_at: string
  event_id: string | null
  partner_id: string | null
}

type ReceivedInvite = {
  id: string
  team_name: string
  status: 'pending_partner'
  created_at: string
  event_id: string | null
  captain_id: string | null
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

function fullName(p: ProfileRow | null | undefined, fallback = 'Oyuncu'): string {
  if (!p) return fallback
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || fallback
}

function Avatar({ profile, name }: { profile: ProfileRow | null | undefined; name: string }) {
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
  const [events, setEvents] = useState<EventRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [actionId, setActionId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)

      const [{ data: sentInvites }, { data: receivedInvites }] = await Promise.all([
        supabase
          .from('team_registrations')
          .select('id, team_name, status, created_at, event_id, partner_id')
          .eq('captain_id', userId)
          .in('status', ['pending_partner', 'pending_approval'])
          .order('created_at', { ascending: false }),
        supabase
          .from('team_registrations')
          .select('id, team_name, status, created_at, event_id, captain_id')
          .eq('partner_id', userId)
          .eq('status', 'pending_partner')
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      const sentRows = (sentInvites ?? []) as SentInvite[]
      const receivedRows = (receivedInvites ?? []) as ReceivedInvite[]

      const eventIds = Array.from(
        new Set(
          [...sentRows, ...receivedRows]
            .map(r => r.event_id)
            .filter((id): id is string => !!id)
        )
      )

      const profileIds = Array.from(
        new Set(
          [
            ...sentRows.map(r => r.partner_id),
            ...receivedRows.map(r => r.captain_id),
          ].filter((id): id is string => !!id)
        )
      )

      const [{ data: eventsData }, { data: profilesData }] = await Promise.all([
        eventIds.length
          ? supabase.from('events').select('id, name, date').in('id', eventIds)
          : Promise.resolve({ data: [] as EventRow[] }),
        profileIds.length
          ? supabase
              .from('profiles')
              .select('id, first_name, last_name, avatar_url')
              .in('id', profileIds)
          : Promise.resolve({ data: [] as ProfileRow[] }),
      ])

      if (cancelled) return

      setSent(sentRows)
      setReceived(receivedRows)
      setEvents((eventsData ?? []) as EventRow[])
      setProfiles((profilesData ?? []) as ProfileRow[])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId, supabase])

  const getEvent = (id: string | null) => (id ? events.find(e => e.id === id) : undefined)
  const getProfile = (id: string | null) => (id ? profiles.find(p => p.id === id) : undefined)

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
            const captain = getProfile(inv.captain_id)
            const event = getEvent(inv.event_id)
            const captainName = fullName(captain, 'Bir oyuncu')
            const isActing = actionId === inv.id
            return (
              <div
                key={inv.id}
                className="bg-[#0f2318] border border-[#2d5a40] rounded-xl p-4 mb-3"
              >
                <div className="flex items-start gap-3">
                  <Avatar profile={captain} name={captainName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-bold">{captainName}</span>
                      <span className="text-white/70"> seni </span>
                      <span className="font-bold text-[#ff6b35]">{inv.team_name}</span>
                      <span className="text-white/70"> takımına davet etti</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-1 truncate">
                      {event?.name ?? '—'}
                      {event?.date && ` · ${formatDate(event.date)}`}
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
            const partner = getProfile(inv.partner_id)
            const event = getEvent(inv.event_id)
            const partnerName = fullName(partner, 'Partner')
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
                  <Avatar profile={partner} name={partnerName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#ff6b35] truncate">
                      {inv.team_name}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      <span className="text-white/60">Partner:</span> {partnerName}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      {event?.name ?? '—'}
                      {event?.date && ` · ${formatDate(event.date)}`}
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
