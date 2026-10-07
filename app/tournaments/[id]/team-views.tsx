import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AvatarPair } from '@/components/ui/avatar'
import { RankMedal } from '@/components/ui/player-row'
import type { GroupStanding, TeamMatch } from '@/lib/team-standings'

export type TeamInfo = {
  id: string
  name: string
  a: { name: string; avatarUrl: string | null }
  b: { name: string; avatarUrl: string | null }
}

export type TeamLookup = (id: string | null) => TeamInfo | null

function TeamLabel({ team, className, size = 'xs' }: { team: TeamInfo | null; className?: string; size?: 'xs' | 'sm' }) {
  if (!team) return <span className={cn('text-sm text-subtle', className)}>TBD</span>
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <AvatarPair a={{ name: team.a.name, src: team.a.avatarUrl }} b={{ name: team.b.name, src: team.b.avatarUrl }} size={size} />
      <span className="truncate text-sm font-medium">{team.name}</span>
    </span>
  )
}

/** MP / W / L / +/- (the app ranks groups by wins, then game difference; there are no points). */
export function StandingsTable({
  title,
  rows,
  team,
  highlightTop = 0,
}: {
  title: string
  rows: GroupStanding[]
  team: TeamLookup
  /** Number of teams that advance (shown with an accent). */
  highlightTop?: number
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <caption className="px-4 pb-1 pt-3 text-left font-display text-lg font-semibold">{title}</caption>
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-subtle">
            <th scope="col" className="w-8 py-2 pl-4 text-left font-medium">#</th>
            <th scope="col" className="py-2 text-left font-medium">Team</th>
            <th scope="col" className="w-9 py-2 text-center font-medium" title="Matches played">MP</th>
            <th scope="col" className="w-8 py-2 text-center font-medium" title="Wins">W</th>
            <th scope="col" className="w-8 py-2 text-center font-medium" title="Losses">L</th>
            <th scope="col" className="w-12 py-2 pr-4 text-right font-medium" title="Game difference">+/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team_id} className="border-t border-border">
              <td className={cn('py-2.5 pl-4 font-display text-base font-semibold tabular', i < highlightTop ? 'text-primary-text' : 'text-muted-foreground')}>
                {i + 1}
              </td>
              <td className="max-w-0 py-2.5 pr-2">
                <TeamLabel team={team(r.team_id)} />
              </td>
              <td className="py-2.5 text-center tabular text-muted-foreground">{r.played}</td>
              <td className="py-2.5 text-center tabular">{r.wins}</td>
              <td className="py-2.5 text-center tabular text-muted-foreground">{r.losses}</td>
              <td className="py-2.5 pr-4 text-right font-display text-base font-semibold tabular">
                {r.diff > 0 ? `+${r.diff}` : r.diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatchSide({ team, score, won, decided }: { team: TeamInfo | null; score: number | null; won: boolean; decided: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-3 py-2', decided && !won && 'opacity-60')}>
      <TeamLabel team={team} />
      <span className={cn('w-6 shrink-0 text-right font-display text-lg font-bold tabular', won ? 'text-primary-text' : 'text-foreground')}>
        {score ?? '–'}
      </span>
    </div>
  )
}

export function MatchCard({ m, team, label, className }: { m: TeamMatch; team: TeamLookup; label?: string; className?: string }) {
  const decided = m.team1_score != null && m.team2_score != null
  const t1Won = decided && m.team1_score! > m.team2_score!
  const t2Won = decided && m.team2_score! > m.team1_score!
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-pitch-850', className)}>
      {label && <p className="border-b border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">{label}</p>}
      <MatchSide team={team(m.team1_id)} score={m.team1_score} won={t1Won} decided={decided} />
      <div className="mx-3 h-px bg-border" />
      <MatchSide team={team(m.team2_id)} score={m.team2_score} won={t2Won} decided={decided} />
    </div>
  )
}

/** Quarter-finals → Semi-finals → Final, horizontally scrollable on phones. */
export function KnockoutBracket({
  rounds,
  team,
}: {
  rounds: { key: string; label: string; matches: TeamMatch[] }[]
  team: TeamLookup
}) {
  const champion = (() => {
    const final = rounds.find(r => r.key === 'final')?.matches[0]
    if (!final || final.team1_score == null || final.team2_score == null) return null
    return team(final.team1_score > final.team2_score ? final.team1_id : final.team2_id)
  })()

  return (
    <div className="space-y-4">
      {champion && (
        <div className="flex items-center gap-3 rounded-2xl border border-medal-gold/40 bg-medal-gold/10 p-4">
          <Trophy className="size-6 shrink-0 text-medal-gold" aria-hidden />
          <div className="min-w-0">
            <p className="text-overline font-semibold uppercase text-medal-gold">Champions</p>
            <TeamLabel team={champion} size="sm" />
          </div>
        </div>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0">
        <div className="flex min-w-max gap-6">
          {rounds.map((r, ri) => (
            <section key={r.key} className="flex w-[230px] flex-col" aria-label={r.label}>
              <h4 className="mb-3 text-sm font-semibold text-muted-foreground">{r.label}</h4>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {r.matches.map(m => (
                  <div
                    key={m.id}
                    className={cn(
                      'relative',
                      // Connector stubs between rounds.
                      ri < rounds.length - 1 && 'after:absolute after:-right-6 after:top-1/2 after:h-px after:w-6 after:bg-border-strong',
                      ri > 0 && 'before:absolute before:-left-6 before:top-1/2 before:h-px before:w-6 before:bg-border-strong'
                    )}
                  >
                    <MatchCard m={m} team={team} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Team Americano finals are placement matches (1st v 2nd, 3rd v 4th, …). */
export function PlacementList({ placements, team }: { placements: { rank: number; team_id: string | null }[]; team: TeamLookup }) {
  return (
    <ol className="space-y-2">
      {placements.map(p => (
        <li key={p.rank} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-border bg-pitch-850 px-3">
          <RankMedal rank={p.rank} />
          <TeamLabel team={team(p.team_id)} size="sm" />
        </li>
      ))}
    </ol>
  )
}
