// Read-only standings for the public tournament page. These mirror the rules in
// app/admin/tournament/team-manager.tsx and team-americano-manager.tsx exactly.

export type TeamMatch = {
  id: string
  phase: 'group' | 'quarter' | 'semi' | 'final'
  group_name: string | null
  round_number: number | null
  team1_id: string | null
  team2_id: string | null
  team1_score: number | null
  team2_score: number | null
  winner_id: string | null
  match_order: number | null
}

export type TeamGroupRow = { team_registration_id: string; group_name: string; position: number | null }

export type GroupStanding = {
  team_id: string
  played: number
  wins: number
  losses: number
  diff: number
}

const scored = (m: TeamMatch) => m.team1_score != null && m.team2_score != null

/** Team (groups + knockout): sort by wins, then game difference (team-manager.tsx). */
export function groupStandings(groupName: string, groups: TeamGroupRow[], matches: TeamMatch[]): GroupStanding[] {
  const ids = groups
    .filter(g => g.group_name === groupName)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(g => g.team_registration_id)
  const rows = new Map<string, GroupStanding>(ids.map(id => [id, { team_id: id, played: 0, wins: 0, losses: 0, diff: 0 }]))
  for (const m of matches) {
    if (m.phase !== 'group' || m.group_name !== groupName || !scored(m)) continue
    const a = m.team1_id ? rows.get(m.team1_id) : undefined
    const b = m.team2_id ? rows.get(m.team2_id) : undefined
    if (!a || !b) continue
    const d = m.team1_score! - m.team2_score!
    a.played++
    b.played++
    a.diff += d
    b.diff -= d
    if (d > 0) {
      a.wins++
      b.losses++
    } else if (d < 0) {
      b.wins++
      a.losses++
    }
  }
  return Array.from(rows.values()).sort((x, y) => (y.wins !== x.wins ? y.wins - x.wins : y.diff - x.diff))
}

/** Team Americano: sort by game difference, then wins, then team name (team-americano-manager.tsx). */
export function teamAmericanoStandings(
  teamIds: string[],
  matches: TeamMatch[],
  label: (id: string) => string
): GroupStanding[] {
  const rows = new Map<string, GroupStanding>(teamIds.map(id => [id, { team_id: id, played: 0, wins: 0, losses: 0, diff: 0 }]))
  for (const m of matches) {
    if (m.phase !== 'group' || !scored(m) || !m.team1_id || !m.team2_id) continue
    const a = rows.get(m.team1_id)
    const b = rows.get(m.team2_id)
    if (!a || !b) continue
    const d = m.team1_score! - m.team2_score!
    a.played++
    b.played++
    a.diff += d
    b.diff -= d
    if (m.team1_score! > m.team2_score!) {
      a.wins++
      b.losses++
    } else {
      b.wins++
      a.losses++
    }
  }
  return Array.from(rows.values()).sort((x, y) => {
    if (y.diff !== x.diff) return y.diff - x.diff
    if (y.wins !== x.wins) return y.wins - x.wins
    return label(x.team_id).localeCompare(label(y.team_id))
  })
}

/** Team Americano finals are placement matches: match_order 1 = 1st/2nd, 2 = 3rd/4th, … */
export function finalPlacements(finals: TeamMatch[]) {
  const out: { rank: number; team_id: string | null }[] = []
  for (const m of [...finals].sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))) {
    if (!scored(m)) continue
    const base = ((m.match_order ?? 0) - 1) * 2 + 1
    const t1Won = m.team1_score! > m.team2_score!
    out.push({ rank: base, team_id: t1Won ? m.team1_id : m.team2_id })
    out.push({ rank: base + 1, team_id: t1Won ? m.team2_id : m.team1_id })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

export function knockoutRounds(matches: TeamMatch[]) {
  const by = (phase: TeamMatch['phase']) =>
    matches.filter(m => m.phase === phase).sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))
  return [
    { key: 'quarter', label: 'Quarter-finals', matches: by('quarter') },
    { key: 'semi', label: 'Semi-finals', matches: by('semi') },
    { key: 'final', label: 'Final', matches: by('final') },
  ].filter(r => r.matches.length > 0)
}
