'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, LayoutGrid, RefreshCw, Timer, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { cn } from '@/lib/utils'
import { Badge, LivePill } from '@/components/ui/badge'
import { Avatar, AvatarPair } from '@/components/ui/avatar'
import { RankMedal } from '@/components/ui/player-row'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeUpItem, FlipNumber, Stagger } from '@/components/motion'

type Match = {
  id: string
  court_number: number
  status: string
  team1_score: number | null
  team2_score: number | null
  team1: [string, string]
  team2: [string, string]
}
type Round = {
  id: string
  round_number: number
  status: string
  duration_minutes: number
  matches: Match[]
}
type Player = {
  id: string
  name: string
  total_games_won: number
  games_played: number
  rank: number
}
type State = {
  tournament: {
    id: string
    mode: string
    status: string
    current_round: number
  } | null
  players: Player[]
  rounds: Round[]
}

// Players in live scoring are plain names (not linked to profiles), so we show initials.
function shortName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return full.trim() || '—'
  const first = parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase()
  return `${first} ${parts[parts.length - 1][0].toUpperCase()}.`
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function useSecondsSince(ts: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(t)
  }, [])
  return ts ? Math.max(0, Math.round((now - ts) / 1000)) : null
}

export default function TournamentPage() {
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [selectedRound, setSelectedRound] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const timerRef = useRef<number | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/tournament', { cache: 'no-store' })
      const data = await res.json()
      setState(data)
      setUpdatedAt(Date.now())
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    const supabase = createClient()
    const channel = supabase
      .channel('tournament-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_rounds' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_players' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => load())
      .subscribe()

    // Fallback polling — runs even if realtime isn't enabled on the project
    timerRef.current = window.setInterval(load, 10000)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [])

  const since = useSecondsSince(updatedAt)

  if (loading && !state) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6" aria-busy="true">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-12 w-full rounded-full" />
        {[0, 1, 2].map(i => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </main>
    )
  }

  if (!state?.tournament) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-10">
        <EmptyState
          className="w-full"
          icon={Timer}
          title="No tournament in progress"
          description="Live scores appear here as soon as the next tournament starts."
          action={
            <Button asChild variant="secondary">
              <Link href="/">Browse tournaments</Link>
            </Button>
          }
        />
      </main>
    )
  }

  const { tournament, players, rounds } = state
  const isFinished = tournament.status === 'finished'
  const isLive = tournament.status === 'active' || tournament.status === 'live' || tournament.status === 'in_progress'
  const totalRounds = rounds.length || 4
  const viewRound = selectedRound ?? (isFinished ? totalRounds : tournament.current_round)
  const round = rounds.find(r => r.round_number === viewRound)
  const courts = round?.matches.length ?? 0
  const isFinalRound = viewRound === totalRounds && totalRounds === 4
  const modeLabel = tournament.mode === 'court' ? 'Court Americano' : 'Americano'
  const shownPlayers = showAll ? players : players.slice(0, 3)

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8 pt-5 md:pt-10">
      {/* Header */}
      <header>
        <h1 className="font-display text-[40px] font-bold leading-none md:text-hero">Live scores</h1>
        <p className="mt-1 font-display text-xl text-muted-foreground">{modeLabel}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {isLive && <LivePill />}
          {isFinished && <Badge variant="muted" size="md">Finished</Badge>}
          <p className="font-display text-lg font-semibold">
            {isFinished ? `${totalRounds} rounds played` : `Round ${tournament.current_round} of ${totalRounds}`}
          </p>
          <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
            {since === null ? '' : since < 10 ? 'Updated just now' : `Updated ${since < 60 ? `${since}s` : `${Math.round(since / 60)}m`} ago`}
          </p>
        </div>
      </header>

      {/* Round selector */}
      <nav aria-label="Rounds" className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex gap-2">
          {rounds.map(r => {
            const active = r.round_number === viewRound
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRound(r.round_number)}
                aria-pressed={active}
                aria-label={`Round ${r.round_number}${r.round_number === 4 ? ' (final)' : ''}`}
                className={cn(
                  'relative inline-flex h-11 min-w-[56px] flex-1 items-center justify-center rounded-full border font-display text-lg font-semibold tabular transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border-strong text-foreground hover:bg-white/5 active:bg-white/10',
                  !active && r.status === 'pending' && 'text-subtle'
                )}
              >
                {r.round_number}
                {r.status === 'active' && !active && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-live" aria-hidden />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Round info */}
      {round && (
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Timer className="size-4" aria-hidden />
            {round.duration_minutes} min round
          </span>
          {courts > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <LayoutGrid className="size-4" aria-hidden />
              {courts} courts
            </span>
          )}
          {isFinalRound && (
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <Trophy className="size-4 text-medal-gold" aria-hidden />
              Final round · court placement
            </span>
          )}
        </p>
      )}

      {/* Courts */}
      <section aria-label="Courts" className="mt-4">
        {!round || round.matches.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="Courts not drawn yet" description="Matches appear here when this round starts." />
        ) : (
          <Stagger className="space-y-3" key={viewRound}>
            {round.matches.map(m => {
              const done = m.status === 'completed' || (m.team1_score !== null && m.team2_score !== null && round.status === 'completed')
              const playing = round.status === 'active' && !done
              const t1Won = done && (m.team1_score ?? 0) > (m.team2_score ?? 0)
              const t2Won = done && (m.team2_score ?? 0) > (m.team1_score ?? 0)
              const base = (m.court_number - 1) * 2 + 1
              return (
                <FadeUpItem key={m.id}>
                  <article className={cn('overflow-hidden rounded-2xl border bg-card shadow-card', playing ? 'border-primary/30' : 'border-border')}>
                    <header className="flex items-center justify-between px-4 pt-3">
                      <h3 className="font-display text-xl font-semibold">
                        Court {m.court_number}
                        {isFinalRound && (
                          <span className="ml-2 text-sm font-medium text-muted-foreground">
                            for {ordinal(base)} / {ordinal(base + 1)}
                          </span>
                        )}
                      </h3>
                      {playing ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary-text">
                          <span className="size-2 rounded-full bg-live motion-safe:animate-pulse" aria-hidden />
                          Live
                        </span>
                      ) : done ? (
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-subtle">Final</span>
                      ) : null}
                    </header>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-4 pt-2">
                      <Pair names={m.team1} won={t1Won} lost={t2Won} />
                      <p className="flex items-center gap-2 font-display text-score font-bold" aria-label={`Score ${m.team1_score ?? 0} to ${m.team2_score ?? 0}`}>
                        <FlipNumber value={m.team1_score ?? '–'} className={cn(t2Won && 'text-muted-foreground')} />
                        <span className="text-3xl text-subtle">:</span>
                        <FlipNumber value={m.team2_score ?? '–'} className={cn(t1Won && 'text-muted-foreground')} />
                      </p>
                      <Pair names={m.team2} won={t2Won} lost={t1Won} />
                    </div>
                  </article>
                </FadeUpItem>
              )
            })}
          </Stagger>
        )}
      </section>

      {/* Standings */}
      <section aria-labelledby="standings-h" className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="standings-h" className="font-display text-2xl font-semibold">
            {isFinished ? 'Final standings' : 'Individual standings'}
          </h2>
          <p className="text-xs uppercase tracking-wider text-subtle">+/- · MP</p>
        </div>
        <ol className="overflow-hidden rounded-2xl border border-border bg-card">
          {shownPlayers.map(p => {
            const diff = p.total_games_won
            return (
              <li key={p.id} className="flex min-h-[60px] items-center gap-3 border-b border-border px-3 last:border-0">
                <RankMedal rank={p.rank} />
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span
                  className={cn(
                    'w-12 text-right font-display text-xl font-bold tabular',
                    diff > 0 ? 'text-success' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  <FlipNumber value={diff > 0 ? `+${diff}` : String(diff)} />
                </span>
                <span className="w-6 text-right text-sm text-muted-foreground tabular">{p.games_played}</span>
              </li>
            )
          })}
        </ol>
        {players.length > 3 && (
          <Button variant="ghost" block className="mt-2 font-sans text-[15px] font-medium text-muted-foreground" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>
            {showAll ? 'Show top 3' : `View full standings (${players.length})`}
            <ChevronDown className={cn('transition-transform', showAll && 'rotate-180')} aria-hidden />
          </Button>
        )}
      </section>

      {isLive && (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4" aria-hidden />
          Scores update automatically
        </p>
      )}
    </main>
  )
}

function Pair({ names, won, lost }: { names: [string, string]; won: boolean; lost: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-1.5 text-center', lost && 'opacity-60')}>
      <AvatarPair a={{ name: names[0] }} b={{ name: names[1] }} size="md" />
      <p className={cn('w-full text-sm leading-tight', won ? 'font-semibold text-foreground' : 'text-foreground/90')}>
        <span className="block truncate">{shortName(names[0])}</span>
        <span className="block truncate">{shortName(names[1])}</span>
      </p>
    </div>
  )
}
