import { type Standing, signed } from '@/lib/team-americano'

type Props = {
  standings: Standing[]
  teamName: (id: string) => string
  rowBg?: string
  border?: string
}

// Compact group standings: # Team P W D L GF GA Diff. Fits a 390 px wide screen.
export default function TeamAmericanoStandings({ standings, teamName, rowBg = 'transparent', border = 'rgba(255,255,255,0.06)' }: Props) {
  const num = 'py-2 px-1 text-right tabular-nums w-7'
  return (
    <table className="w-full text-xs table-fixed">
      <thead>
        <tr className="text-white/60 text-[10px] uppercase tracking-wide" style={{ backgroundColor: rowBg }}>
          <th className="py-2 pl-3 pr-1 text-left font-semibold w-7">#</th>
          <th className="py-2 px-1 text-left font-semibold">Team</th>
          <th className={`${num} font-semibold`} title="Played">P</th>
          <th className={`${num} font-semibold`} title="Wins">W</th>
          <th className={`${num} font-semibold`} title="Draws">D</th>
          <th className={`${num} font-semibold`} title="Losses">L</th>
          <th className={`${num} font-semibold`} title="Games for">GF</th>
          <th className={`${num} font-semibold`} title="Games against">GA</th>
          <th className="py-2 pl-1 pr-3 text-right font-semibold w-11" title="Game difference">Diff</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => (
          <tr key={s.team_id} style={{ borderTop: `1px solid ${border}`, backgroundColor: rowBg }}>
            <td className="py-2 pl-3 pr-1 font-bold text-white">{i + 1}</td>
            <td className="py-2 px-1 font-semibold text-white">
              <div className="truncate">{teamName(s.team_id)}</div>
            </td>
            <td className={`${num} text-white/60`}>{s.played}</td>
            <td className={`${num} text-white font-bold`}>{s.wins}</td>
            <td className={`${num} text-white/70`}>{s.draws}</td>
            <td className={`${num} text-white/70`}>{s.losses}</td>
            <td className={`${num} text-white/80`}>{s.gamesWon}</td>
            <td className={`${num} text-white/60`}>{s.gamesLost}</td>
            <td
              className="py-2 pl-1 pr-3 text-right tabular-nums font-bold"
              style={{ color: s.diff > 0 ? '#4ade80' : s.diff < 0 ? '#f87171' : 'rgba(255,255,255,0.6)' }}
            >
              {signed(s.diff)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export const STANDINGS_RULE = 'Wins → game difference → games won → head-to-head → random draw'
