'use client'

import {
  FINALS_MINUTES,
  GROUP_ROUNDS,
  GROUP_ROUND_MINUTES,
  type LiveState,
  type TAMatch,
  byeTeamsByRound,
  computeStandings,
  finalLabel,
  finalMatchesOf,
  finalRanking,
  isScored,
  missingGroupRounds,
  ordinal,
  roundMatches,
  signed,
} from '@/lib/team-americano'

const CARD = { backgroundColor: '#0f2a1f', border: '1px solid rgba(255,255,255,0.08)' }
const ORANGE = '#ff6b35'

// Read-only live view of a Team Americano event (used by /tournament).
export default function TeamAmericanoLive({ state }: { state: LiveState }) {
  const { event, teams, matches } = state
  if (!event) return null

  const teamById = new Map(teams.map(t => [t.id, t]))
  const teamIds = teams.map(t => t.id)
  const name = (id: string | null) => (id ? teamById.get(id)?.team_name ?? '—' : '—')
  const playersOf = (id: string | null) => (id ? teamById.get(id)?.players.join(' & ') ?? '' : '')

  const finals = finalMatchesOf(matches)
  const ranking = finalRanking(teamIds, matches)
  const standings = computeStandings(event.id, teamIds, matches)
  const inFinals = finals.length > 0
  const missing = missingGroupRounds(matches)
  const rounds = Array.from({ length: GROUP_ROUNDS }, (_, i) => i + 1).filter(r => !missing.includes(r))
  const byes = byeTeamsByRound(teamIds, matches)

  const status = ranking
    ? 'Tournament Finished'
    : inFinals
    ? `Finals · ${FINALS_MINUTES} min`
    : `Group Stage · ${GROUP_ROUNDS} rounds × ${GROUP_ROUND_MINUTES} min`

  const matchCard = (m: TAMatch, title: string) => {
    const scored = isScored(m)
    const t1Won = scored && (m.team1_score ?? 0) > (m.team2_score ?? 0)
    const t2Won = scored && (m.team2_score ?? 0) > (m.team1_score ?? 0)
    return (
      <div key={m.id} className="rounded-xl p-4" style={CARD}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ORANGE }}>
            {title}
          </p>
          {scored && <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Final score</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug truncate" style={{ color: t1Won ? ORANGE : '#fff' }}>
              {name(m.team1_id)}
            </p>
            <p className="text-[11px] text-white/55 leading-snug">{playersOf(m.team1_id)}</p>
          </div>
          <div className="px-3 py-2 rounded-lg text-center min-w-[72px]" style={{ backgroundColor: '#1a3d2e' }}>
            <p className="text-lg font-bold text-white tabular-nums">
              {m.team1_score ?? '—'}
              <span className="text-white/40 mx-1">:</span>
              {m.team2_score ?? '—'}
            </p>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-semibold leading-snug truncate" style={{ color: t2Won ? ORANGE : '#fff' }}>
              {name(m.team2_id)}
            </p>
            <p className="text-[11px] text-white/55 leading-snug">{playersOf(m.team2_id)}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen py-8 px-4 sm:py-12" style={{ backgroundColor: '#1a3d2e' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-6">
          <img src="/smashpadel_logo.png" alt="Smash Padel" width={72} height={72} className="rounded-full mb-3" />
          <p className="text-xs tracking-[0.3em] uppercase text-white/60">SmashTorino</p>
          <h1 className="text-2xl font-bold text-white mt-2 text-center">{event.name}</h1>
          <p className="text-xs text-white/60 mt-1">Team Americano</p>
        </div>

        <div className="rounded-xl px-5 py-4 mb-6 text-center" style={CARD}>
          <p className="text-xs tracking-[0.25em] uppercase font-semibold" style={{ color: ORANGE }}>
            {status}
          </p>
        </div>

        {ranking && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-white/90 mb-3">Final Ranking</h2>
            <div className="rounded-xl overflow-hidden" style={CARD}>
              <table className="w-full text-sm">
                <tbody>
                  {ranking.map(p => (
                    <tr
                      key={p.team_id}
                      className="border-t first:border-t-0"
                      style={{
                        borderColor: 'rgba(255,255,255,0.06)',
                        backgroundColor: p.rank === 1 ? 'rgba(255,107,53,0.12)' : undefined,
                      }}
                    >
                      <td className="py-3 px-3 font-bold w-16" style={{ color: p.rank === 1 ? ORANGE : '#fff' }}>
                        {p.rank === 1 ? '🏆' : ordinal(p.rank)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-semibold text-white">{name(p.team_id)}</div>
                        <div className="text-[11px] text-white/55">{playersOf(p.team_id)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {inFinals && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-white/90 mb-3">Finals</h2>
            <div className="space-y-3">
              {finals.map(m =>
                matchCard(
                  m,
                  `${m.match_order === 1 ? '🏆 ' : ''}${finalLabel(m.match_order ?? 1)} · Court ${m.match_order ?? '?'}`
                )
              )}
            </div>
          </section>
        )}

        {rounds.map(r => (
          <section key={r} className="mb-8">
            <h2 className="text-sm font-semibold text-white/90 mb-3">Round {r}</h2>
            {(byes.get(r) ?? []).map(id => (
              <p key={id} className="text-xs text-yellow-200 mb-2">
                Bye: {name(id)}
              </p>
            ))}
            <div className="space-y-3">{roundMatches(matches, r).map(m => matchCard(m, `Court ${m.match_order ?? '?'}`))}</div>
          </section>
        ))}

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white/90 mb-3">
            {inFinals ? 'Group Standings (Rounds 1–3)' : 'Live Standings'}
          </h2>
          <div className="rounded-xl overflow-hidden" style={CARD}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/60 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 text-left font-semibold">#</th>
                  <th className="py-3 px-2 text-left font-semibold">Team</th>
                  <th className="py-3 px-2 text-right font-semibold">Played</th>
                  <th className="py-3 px-2 text-right font-semibold">Games Won</th>
                  <th className="py-3 px-3 text-right font-semibold">+/-</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.team_id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <td className="py-3 px-3 font-bold text-white">{i + 1}</td>
                    <td className="py-3 px-2 font-semibold text-white">{name(s.team_id)}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-white/60">{s.played}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-white">{s.gamesWon}</td>
                    <td
                      className="py-3 px-3 text-right tabular-nums font-bold"
                      style={{ color: s.diff > 0 ? '#4ade80' : s.diff < 0 ? '#f87171' : 'rgba(255,255,255,0.7)' }}
                    >
                      {signed(s.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-10 text-center">
          <a href="/" className="text-xs text-white/50 underline">
            Back to Tournament Page
          </a>
        </div>
      </div>
    </main>
  )
}
