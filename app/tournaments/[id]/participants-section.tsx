'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

type Participant = {
  status: string
  profiles: {
    first_name: string | null
    last_name: string | null
    skill_score: number | null
    skill_level: string | null
  }
}

function skillLevelColor(level: string | null) {
  switch (level) {
    case 'Advanced':     return { bg: 'rgba(249,115,22,0.2)', color: '#f97316' }
    case 'Intermediate': return { bg: 'rgba(34,197,94,0.2)',  color: '#22c55e' }
    case 'Beginner':     return { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' }
    default:             return { bg: 'rgba(107,114,128,0.2)', color: '#6b7280' }
  }
}

function rankBorder(idx: number) {
  if (idx === 0) return '2px solid #f59e0b'
  if (idx === 1) return '2px solid #9ca3af'
  if (idx === 2) return '2px solid #92400e'
  return '1px solid rgba(255,255,255,0.06)'
}

function rankBg(idx: number) {
  if (idx === 0) return 'rgba(245,158,11,0.06)'
  if (idx === 1) return 'rgba(156,163,175,0.06)'
  if (idx === 2) return 'rgba(146,64,14,0.06)'
  return 'rgba(255,255,255,0.03)'
}

export default function ParticipantsSection({ eventId }: { eventId: string }) {
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined)
  const [participants, setParticipants] = useState<Participant[] | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('User:', user?.id)
      setUser(user)

      if (!user) {
        setParticipants(null)
        return
      }

      const { data } = await supabase
        .from('event_registrations')
        .select(`
          status,
          profiles!inner (
            first_name,
            last_name,
            skill_score,
            skill_level
          )
        `)
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true })

      console.log('Participants:', data)
      setParticipants((data as unknown as Participant[]) ?? [])
    }

    load()
  }, [eventId])

  // Still loading auth state
  if (user === undefined) return null

  if (!user) {
    return (
      <div
        className="rounded-xl p-4 text-center"
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <p className="text-sm text-white/70">
          <Link
            href={`/signin?redirect=/tournaments/${eventId}`}
            className="font-semibold underline"
            style={{ color: '#ff6b35' }}
          >
            Sign in
          </Link>{' '}
          to see participants
        </p>
      </div>
    )
  }

  const sorted = participants
    ? [...participants].sort(
        (a, b) => (b.profiles?.skill_score ?? 0) - (a.profiles?.skill_score ?? 0)
      )
    : null

  return (
    <div>
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
        Participants ({sorted?.length ?? 0})
      </p>

      {!sorted || sorted.length === 0 ? (
        <p className="text-sm text-white/50 text-center py-3">No participants yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sorted.map((p, idx) => {
            const { bg: levelBg, color: levelColor } = skillLevelColor(p.profiles?.skill_level ?? null)
            const name =
              [p.profiles?.first_name, p.profiles?.last_name].filter(Boolean).join(' ') || 'Player'
            const score = p.profiles?.skill_score ?? 0
            const level = p.profiles?.skill_level

            return (
              <div
                key={idx}
                className="rounded-xl px-3 py-3 flex flex-col gap-1.5"
                style={{ backgroundColor: rankBg(idx), border: rankBorder(idx) }}
              >
                <div className="flex items-center gap-1.5">
                  {idx < 3 && (
                    <span className="text-sm leading-none">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-white truncate">{name}</span>
                </div>
                {level && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full self-start"
                    style={{ backgroundColor: levelBg, color: levelColor }}
                  >
                    {level}
                  </span>
                )}
                {score > 0 && (
                  <span className="text-[11px] text-white/50">{score} pts</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
