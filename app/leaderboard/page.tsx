'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { getLevel } from '@/lib/quiz-questions'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { SkillBadge } from '@/components/ui/badge'
import { RankMedal } from '@/components/ui/player-row'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PlayerRowSkeleton } from '@/components/ui/skeleton'
import { FadeUpItem, Stagger } from '@/components/motion'

type Row = {
  key: string
  userId: string | null
  avatarUrl: string | null
  firstName: string | null
  lastName: string | null
  skillScore: number
  lastScoreChange: number | null
}

// Public list: first name + last initial (unchanged privacy rule).
function maskName(first: string | null, last: string | null) {
  const f = first ?? ''
  const l = last ? last.charAt(0) + '.' : ''
  return `${f} ${l}`.trim() || 'Player'
}

function Change({ change }: { change: number | null | undefined }) {
  if (change == null || change === 0) return null
  const up = change > 0
  return (
    <span className={cn('text-xs font-semibold tabular', up ? 'text-success' : 'text-destructive')} aria-label={`Last change ${up ? '+' : ''}${change}`}>
      {up ? '▲ +' : '▼ '}
      {change}
    </span>
  )
}

export default function LeaderboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      // Profiles + legacy quiz entries (de-duplicated by email in the DB function)
      const [{ data: profiles }, { data: regs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, skill_score, last_score_change, player_code')
          .not('skill_score', 'is', null)
          .gt('skill_score', 0),
        supabase.rpc('legacy_leaderboard_entries'),
      ])

      const merged = new Map<string, Row>()
      for (const p of profiles ?? []) {
        const key = p.id
        merged.set(key, {
          key,
          userId: p.id,
          avatarUrl: p.avatar_url ?? null,
          firstName: p.first_name,
          lastName: p.last_name,
          skillScore: p.skill_score ?? 0,
          lastScoreChange: p.last_score_change ?? null,
        })
      }
      for (const r of (regs ?? []) as { id: string; first_name: string | null; last_name: string | null; skill_score: number | null; last_score_change: number | null }[]) {
        const key = `legacy:${r.id}`
        merged.set(key, {
          key,
          userId: null,
          avatarUrl: null,
          firstName: r.first_name,
          lastName: r.last_name,
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

  const myRank = currentUserId ? rows.findIndex(r => r.userId === currentUserId) + 1 : 0

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-6 md:pt-10">
      <p className="text-overline font-semibold uppercase text-muted-foreground">Turin padel community</p>
      <h1 className="mt-1 font-display text-[40px] font-bold leading-none md:text-hero">Leaderboard</h1>
      <p className="mt-2 text-[17px] text-foreground/80">Skill ratings — top players first.</p>
      {myRank > 0 && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary-text">
          <Trophy className="size-4" aria-hidden />
          You are #{myRank} of {rows.length}
        </p>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <PlayerRowSkeleton key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No rankings yet"
            description="Take the skill quiz to get your first rating."
            action={
              <Button asChild>
                <Link href="/quiz">Take the quiz</Link>
              </Button>
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <Stagger as="ol">
              {rows.map((row, i) => {
                const rank = i + 1
                const me = currentUserId != null && row.userId === currentUserId
                const name = maskName(row.firstName, row.lastName)
                return (
                  <FadeUpItem as="li" key={row.key}>
                    <div
                      className={cn(
                        'flex min-h-[64px] items-center gap-3 border-b border-border px-3 py-2 last:border-0',
                        me && 'bg-primary/10'
                      )}
                      aria-current={me ? 'true' : undefined}
                    >
                      <RankMedal rank={rank} />
                      <Avatar src={row.avatarUrl} name={name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[17px] font-semibold leading-tight">
                          {name}
                          {me && <span className="ml-2 font-sans text-xs font-medium text-primary-text">You</span>}
                        </p>
                        <Change change={row.lastScoreChange} />
                      </div>
                      <SkillBadge level={getLevel(row.skillScore)} />
                      <span className="w-12 text-right font-display text-lg font-semibold tabular">{row.skillScore}</span>
                    </div>
                  </FadeUpItem>
                )
              })}
            </Stagger>
          </Card>
        )}
      </div>
    </main>
  )
}
