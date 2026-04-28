'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

type CaptainEmbed = {
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

type EventEmbed = {
  name: string
  date: string | null
  location: string | null
}

type Registration = {
  id: string
  team_name: string
  status: 'pending_partner' | 'pending_approval' | 'approved' | 'rejected'
  partner_confirmed: boolean
  event: EventEmbed | null
  captain: CaptainEmbed | null
}

type RawRegistration = Omit<Registration, 'event' | 'captain'> & {
  event: EventEmbed | EventEmbed[] | null
  captain: CaptainEmbed | CaptainEmbed[] | null
}

type Result = 'accepted' | 'rejected' | null

function unwrap<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

function formatDate(date: string | null): string {
  if (!date) return ''
  try {
    return new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return date
  }
}

export default function TeamInvitePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const id = params?.id

  const [loading, setLoading] = useState(true)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const autoRan = useRef(false)

  const handleRespond = useCallback(async (action: 'accept' | 'reject') => {
    if (responding) return
    setResponding(true)
    setError(null)
    try {
      const res = await fetch('/api/team-registration/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: id, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu.')
        setResponding(false)
        return
      }
      setResult(action === 'accept' ? 'accepted' : 'rejected')
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setResponding(false)
    }
  }, [id, responding])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/signin?redirect=/team-invite/${id}`)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('team_registrations')
        .select(
          'id, team_name, status, partner_confirmed, event:events(name, date, location), captain:profiles!team_registrations_captain_id_fkey(first_name, last_name, avatar_url)'
        )
        .eq('id', id)
        .single()

      if (cancelled) return

      if (fetchError || !data) {
        setError('Davet bulunamadı.')
        setLoading(false)
        return
      }

      const raw = data as unknown as RawRegistration
      const reg: Registration = {
        id: raw.id,
        team_name: raw.team_name,
        status: raw.status,
        partner_confirmed: raw.partner_confirmed,
        event: unwrap(raw.event),
        captain: unwrap(raw.captain),
      }

      setRegistration(reg)
      setLoading(false)

      const action = searchParams?.get('action')
      if (
        !autoRan.current &&
        reg.status === 'pending_partner' &&
        (action === 'accept' || action === 'reject')
      ) {
        autoRan.current = true
        handleRespond(action)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, router, searchParams, supabase, handleRespond])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0f2318]">
        <div
          className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: '#2d5a40', borderTopColor: '#ff6b35' }}
        />
      </main>
    )
  }

  if (error && !registration) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#0f2318]">
        <div className="max-w-md w-full rounded-2xl p-8 text-center bg-[#1a3d2e] border border-[#2d5a40]">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-white mb-2">Davet Bulunamadı</h1>
          <p className="text-sm text-white/70 mb-6">{error}</p>
          <Link href="/" className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#ff6b35]">
            Anasayfa
          </Link>
        </div>
      </main>
    )
  }

  if (result === 'accepted') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#0f2318]">
        <div className="max-w-md w-full rounded-2xl p-8 text-center bg-[#1a3d2e] border border-[#2d5a40]">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">Daveti Kabul Ettiniz!</h1>
          <p className="text-sm text-white/80 mb-6">
            <strong className="text-[#ff6b35]">"{registration?.team_name}"</strong> takımına katıldın.
            Admin onayı bekleniyor — onaylandığında bilgilendirileceksin.
          </p>
          <Link href="/dashboard" className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#ff6b35]">
            Dashboard'a Git
          </Link>
        </div>
      </main>
    )
  }

  if (result === 'rejected') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#0f2318]">
        <div className="max-w-md w-full rounded-2xl p-8 text-center bg-[#1a3d2e] border border-[#2d5a40]">
          <div className="text-6xl mb-4">👋</div>
          <h1 className="text-2xl font-bold text-white mb-2">Davet Reddedildi</h1>
          <p className="text-sm text-white/80 mb-6">Daveti reddettin. Kaptan bilgilendirildi.</p>
          <Link href="/" className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#ff6b35]">
            Anasayfa
          </Link>
        </div>
      </main>
    )
  }

  if (!registration) return null

  if (registration.status !== 'pending_partner') {
    const info = {
      pending_approval: { emoji: '⏳', title: 'Onay Bekleniyor', text: 'Bu davete zaten yanıt verdin. Yöneticilerin onayı bekleniyor.' },
      approved: { emoji: '✅', title: 'Takım Onaylandı', text: 'Bu takım zaten onaylandı.' },
      rejected: { emoji: '❌', title: 'Davet Reddedildi', text: 'Bu davet reddedildi.' },
    }[registration.status]

    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#0f2318]">
        <div className="max-w-md w-full rounded-2xl p-8 text-center bg-[#1a3d2e] border border-[#2d5a40]">
          <div className="text-6xl mb-4">{info.emoji}</div>
          <h1 className="text-2xl font-bold text-white mb-2">{info.title}</h1>
          <p className="text-sm text-white/80 mb-6">{info.text}</p>
          <Link href="/dashboard" className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#ff6b35]">
            Dashboard'a Git
          </Link>
        </div>
      </main>
    )
  }

  const captain = registration.captain
  const captainName = [captain?.first_name, captain?.last_name].filter(Boolean).join(' ').trim() || 'Bir oyuncu'
  const captainInitial = (captain?.first_name?.[0] ?? '?').toUpperCase()
  const event = registration.event

  return (
    <main className="min-h-screen py-10 px-4 bg-[#0f2318]">
      <div className="max-w-md mx-auto">
        <div className="rounded-2xl overflow-hidden bg-[#1a3d2e] border border-[#2d5a40]">
          <div className="px-6 py-5 text-center bg-[#0f2318]" style={{ borderBottom: '3px solid #ff6b35' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-[#ff6b35]">🎾 Takım Daveti</p>
            <h1 className="text-xl font-bold text-white mt-2">Sana bir davet var!</h1>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              {captain?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={captain.avatar_url}
                  alt={captainName}
                  width={56}
                  height={56}
                  className="rounded-full object-cover"
                  style={{ width: 56, height: 56 }}
                />
              ) : (
                <span
                  className="flex items-center justify-center rounded-full text-xl font-bold text-white bg-[#ff6b35]"
                  style={{ width: 56, height: 56 }}
                >
                  {captainInitial}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 uppercase tracking-wide font-semibold">Kaptan</p>
                <p className="text-base font-bold text-white truncate">{captainName}</p>
              </div>
            </div>

            <div className="rounded-xl p-4 mb-4 bg-[#0f2318] border border-[#2d5a40]">
              <p className="text-xs text-white/60 uppercase tracking-wide font-semibold mb-1">Takım Adı</p>
              <p className="text-2xl font-bold text-[#ff6b35]">{registration.team_name}</p>
            </div>

            {event && (
              <div className="rounded-xl p-4 mb-6 bg-[#0f2318] border border-[#2d5a40]">
                <p className="text-xs text-white/60 uppercase tracking-wide font-semibold mb-2">Etkinlik</p>
                <p className="text-base font-bold text-white mb-2">{event.name}</p>
                {event.date && <p className="text-xs text-white/80">📅 {formatDate(event.date)}</p>}
                {event.location && <p className="text-xs text-white/80 mt-1">📍 {event.location}</p>}
              </div>
            )}

            {error && <p className="text-xs text-red-300 mb-3 text-center">{error}</p>}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleRespond('accept')}
                disabled={responding}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 bg-[#ff6b35]"
              >
                {responding ? 'İşleniyor...' : '✅ Daveti Kabul Et'}
              </button>
              <button
                type="button"
                onClick={() => handleRespond('reject')}
                disabled={responding}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white/80 transition disabled:opacity-50 bg-transparent border border-[#2d5a40]"
              >
                Reddet
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
