import {
  type CourtPair,
  type LightsOutFormat,
  type LOStanding,
  type LOTeamView,
  lightsOutRules,
  loStructureLabel,
  ordinal,
  signed,
} from '@/lib/lights-out'

// Presentational pieces shared by the admin manager and the public event page.
// No hooks, so they render in both server and client components.

const CARD = { backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }
const ROW_BORDER = { borderColor: 'rgba(255,255,255,0.06)' }
const ORANGE = '#ff6b35'

type TeamLookup = Map<string, LOTeamView>

export function LightsOutRules({ format, courts }: { format: LightsOutFormat; courts: number }) {
  return (
    <div className="rounded-xl p-4" style={CARD}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-white">How Lights Out works</p>
        <span className="text-xs text-white/50 text-right">{loStructureLabel(format)}</span>
      </div>
      <ul className="space-y-1.5">
        {lightsOutRules(format, courts).map(rule => (
          <li key={rule} className="flex gap-2 text-[13px] leading-snug text-white/75">
            <span aria-hidden="true" style={{ color: ORANGE }}>
              •
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TeamLine({ team }: { team: LOTeamView | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[15px] font-semibold text-white break-words">{team?.team_name ?? '—'}</p>
      <p className="text-xs text-white/55 break-words">{team?.players.join(' & ') || '—'}</p>
    </div>
  )
}

// Court-by-court list of the initial draw.
export function LightsOutDraw({ draw, teams }: { draw: CourtPair[]; teams: TeamLookup }) {
  const last = draw.length
  return (
    <div className="space-y-3">
      {draw.map(d => (
        <div key={d.court} className="rounded-xl overflow-hidden" style={CARD}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
            <p className="text-sm font-bold" style={{ color: ORANGE }}>
              Court {d.court}
            </p>
            {(d.court === 1 || d.court === last) && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                {d.court === 1 ? 'Top court' : 'Bottom court'}
              </span>
            )}
          </div>
          <div className="px-4 py-3">
            <TeamLine team={teams.get(d.team1_id)} />
            <p className="my-2 text-[10px] font-bold uppercase tracking-widest text-white/35">vs</p>
            <TeamLine team={teams.get(d.team2_id)} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Final standings by court placement, with the points each player gets.
export function LightsOutStandings({ standings, teams }: { standings: LOStanding[]; teams: TeamLookup }) {
  return (
    <div className="rounded-xl overflow-hidden" style={CARD}>
      {standings.map((s, i) => {
        const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : null
        const color = s.points > 0 ? '#4ade80' : s.points < 0 ? '#f87171' : 'rgba(255,255,255,0.7)'
        return (
          <div
            key={s.team_id}
            className={`px-4 py-3 flex items-center gap-3 ${i > 0 ? 'border-t' : ''}`}
            style={{ ...ROW_BORDER, backgroundColor: s.rank === 1 ? 'rgba(255,107,53,0.10)' : undefined }}
          >
            <div className="w-10 shrink-0 text-center">
              {medal ? <span className="text-xl">{medal}</span> : <span className="text-sm font-bold text-white/60">{ordinal(s.rank)}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <TeamLine team={teams.get(s.team_id)} />
              <p className="text-[11px] text-white/40 mt-0.5">
                Court {s.court} {s.won ? 'winner' : 'loser'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold tabular-nums" style={{ color }}>
                {signed(s.points)}
              </p>
              <p className="text-[10px] text-white/40">per player</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
