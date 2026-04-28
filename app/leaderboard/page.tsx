'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { getLevel, getLevelColor } from '@/lib/quiz-questions'

type Row = {
  key: string
  userId: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  skillScore: number
  lastScoreChange: number | null
}

function rankStyle(rank: number): { bg: string; text: string; medal: string } {
  if (rank === 1)
    return {
      bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      text: '#422006',
      medal: '🥇',
    }
  if (rank === 2)
    return {
      bg: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
      text: '#1e293b',
      medal: '🥈',
    }
  if (rank === 3)
    return {
      bg: 'linear-gradient(135deg, #d6966b 0%, #a16207 100%)',
      text: '#fff7ed',
      medal: '🥉',
    }
  return { bg: '', text: '#fff', medal: '' }
}

function maskName(first: string | null, last: string | null) {
  const f = first ?? ''
  const l = last ? last.charAt(0) + '.' : ''
  return `${f} ${l}`.trim() || 'Player'
}

function ChangePill({ change }: { change: number | null | undefined }) {
  if (change == null || change === 0) return null
  const positive = change > 0
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{
        backgroundColor: positive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        color: positive ? '#22c55e' : '#f87171',
        border: `1px solid ${positive ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
      }}
    >
      {positive ? '▲' : '▼'} {positive ? '+' : ''}
      {change}
    </span>
  )
}

export default function LeaderboardPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      // Merge profiles + tournament_registrations, dedup by lowercased email
      const [{ data: profiles }, { data: regs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email, skill_score, last_score_change')
          .not('skill_score', 'is', null)
          .gt('skill_score', 0),
        supabase
          .from('tournament_registrations')
          .select('id, first_name, last_name, email, skill_score, last_score_change')
          .not('skill_score', 'is', null)
          .gt('skill_score', 0)
          .not('quiz_completed_at', 'is', null),
      ])

      const merged = new Map<string, Row>()
      for (const p of profiles ?? []) {
        const key = (p.email ?? p.id).toLowerCase()
        merged.set(key, {
          key,
          userId: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          email: p.email,
          skillScore: p.skill_score ?? 0,
          lastScoreChange: p.last_score_change ?? null,
        })
      }
      for (const r of regs ?? []) {
        const key = (r.email ?? r.id).toLowerCase()
        if (merged.has(key)) continue // profile takes precedence
        merged.set(key, {
          key,
          userId: null,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          skillScore: r.skill_score ?? 0,
          lastScoreChange: r.last_score_change ?? null,
        })
      }

      const arr = Array.from(merged.values()).sort(
        (a, b) => b.skillScore - a.skillScore
      )
      setRows(arr)
      setLoading(false)
    }
    load()
  }, [supabase])

  const myRank = currentUserId
    ? rows.findIndex(r => r.userId === currentUserId) + 1
    : 0

  return (
    <main
      className="flex-1 py-10 px-4 sm:py-14"
      style={{ backgroundColor: '#1a3d2e' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <p
            className="text-xs tracking-[0.3em] uppercase font-semibold mb-2"
            style={{ color: '#ff6b35' }}
          >
            SmashTorino
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            🏆 Leaderboard
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Padel skill rankings — top players first
          </p>
          {myRank > 0 && (
            <p className="text-xs text-white/80 mt-3">
              Your rank:{' '}
              <span className="font-bold" style={{ color: '#ff6b35' }}>
                #{myRank}
              </span>
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-sm text-white/60">Loading rankings...</p>
        ) : rows.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              backgroundColor: '#0f2a1f',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <p className="text-sm text-white/70">
              No one has completed the quiz yet. Be the first!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Podium: top 3 */}
            {rows.slice(0, 3).length > 0 && (
              <div className="mb-2">
                {rows.slice(0, 3).map((row, idx) => {
                  const rank = idx + 1
                  const style = rankStyle(rank)
                  const levelName = getLevel(row.skillScore)
                  const levelColor = getLevelColor(levelName)
                  const isMe =
                    currentUserId != null && row.userId === currentUserId
                  return (
                    <div
                      key={row.key}
                      className="rounded-2xl p-4 sm:p-5 mb-3 flex items-center gap-4 shadow-xl"
                      style={{
                        background: style.bg,
                        border: isMe
                          ? '2px solid #ff6b35'
                          : '1px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      <div className="flex-shrink-0 text-3xl sm:text-4xl">
                        {style.medal}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-bold tracking-wider uppercase opacity-70"
                          style={{ color: style.text }}
                        >
                          Rank #{rank} {isMe && '· You'}
                        </p>
                        <p
                          className="text-lg sm:text-xl font-bold truncate"
                          style={{ color: style.text }}
                        >
                          {maskName(row.firstName, row.lastName)}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <div
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background: levelColor.bg,
                              color: levelColor.text,
                            }}
                          >
                            {levelColor.icon && <span>{levelColor.icon}</span>}
                            <span>{levelName}</span>
                          </div>
                          <ChangePill change={row.lastScoreChange} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className="text-2xl sm:text-3xl font-bold leading-none"
                          style={{ color: style.text }}
                        >
                          {row.skillScore}
                        </p>
                        <p
                          className="text-[10px] font-semibold opacity-60 mt-1"
                          style={{ color: style.text }}
                        >
                          pts
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Rest */}
            {rows.length > 3 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: '#0f2a1f',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {rows.slice(3).map((row, idx) => {
                  const rank = idx + 4
                  const levelName = getLevel(row.skillScore)
                  const levelColor = getLevelColor(levelName)
                  const isMe =
                    currentUserId != null && row.userId === currentUserId
                  return (
                    <div
                      key={row.key}
                      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 border-b last:border-b-0"
                      style={{
                        borderColor: 'rgba(255,255,255,0.06)',
                        backgroundColor: isMe
                          ? 'rgba(255,107,53,0.08)'
                          : 'transparent',
                      }}
                    >
                      <div className="flex-shrink-0 w-8 text-center text-sm font-bold text-white/60">
                        {rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {maskName(row.firstName, row.lastName)}
                          {isMe && (
                            <span
                              className="ml-2 text-[10px] font-bold"
                              style={{ color: '#ff6b35' }}
                            >
                              · You
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <div
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background: levelColor.bg,
                              color: levelColor.text,
                            }}
                          >
                            {levelColor.icon && <span>{levelColor.icon}</span>}
                            <span>{levelName}</span>
                          </div>
                          <ChangePill change={row.lastScoreChange} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-white leading-none">
                          {row.skillScore}
                        </p>
                        <p className="text-[10px] text-white/40 font-semibold mt-1">
                          pts
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
