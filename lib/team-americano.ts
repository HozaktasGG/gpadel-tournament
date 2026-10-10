// Shared Team Americano logic (admin manager, API routes and the public live view).
// Format: 3 random group rounds drawn up front (no repeat matchups, max one bye per team),
// then a finals round pairing #1v#2, #3v#4, ... by group standings.

export const GROUP_ROUNDS = 3
export const FINALS_ROUND = 4
export const DEFAULT_COURTS = 5
export const GROUP_ROUND_MINUTES = 20
export const FINALS_MINUTES = 30

export type TAMatch = {
  id: string
  phase: string
  round_number: number | null
  team1_id: string | null
  team2_id: string | null
  team1_score: number | null
  team2_score: number | null
  winner_id: string | null
  match_order: number | null
}

export type Pairing = { team1_id: string; team2_id: string }

export type Standing = {
  team_id: string
  played: number
  gamesWon: number
  gamesLost: number
  diff: number
  byes: number
}

export type Placement = { rank: number; team_id: string }

// Shape returned by /api/team-americano/live (public, read-only).
export type LiveTeam = { id: string; team_name: string; players: string[] }
export type LiveState = {
  event: { id: string; name: string; date: string } | null
  teams: LiveTeam[]
  matches: TAMatch[]
}

export const isScored = (m: TAMatch): boolean => m.team1_score !== null && m.team2_score !== null

export const groupMatchesOf = (matches: TAMatch[]): TAMatch[] =>
  matches.filter(m => m.phase === 'group')

export const finalMatchesOf = (matches: TAMatch[]): TAMatch[] =>
  matches
    .filter(m => m.phase === 'final')
    .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))

export const roundMatches = (matches: TAMatch[], round: number): TAMatch[] =>
  groupMatchesOf(matches)
    .filter(m => m.round_number === round)
    .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Teams that sat out a group round (were not in any match of that round).
export function byeTeamsByRound(teamIds: string[], matches: TAMatch[]): Map<number, string[]> {
  const out = new Map<number, string[]>()
  const rounds = new Set(groupMatchesOf(matches).map(m => m.round_number ?? 0))
  for (const r of Array.from(rounds)) {
    const playing = new Set(roundMatches(matches, r).flatMap(m => [m.team1_id, m.team2_id]))
    out.set(r, teamIds.filter(id => !playing.has(id)))
  }
  return out
}

export type RequiredMatchup = { team1_id: string; team2_id: string; round: number | null }
export type GeneratedRound = { round: number; pairings: Pairing[]; bye: string | null }

// Group rounds (1..GROUP_ROUNDS) that have no matches yet.
export function missingGroupRounds(matches: TAMatch[]): number[] {
  const existing = new Set(groupMatchesOf(matches).map(m => m.round_number ?? 0))
  return Array.from({ length: GROUP_ROUNDS }, (_, i) => i + 1).filter(r => !existing.has(r))
}

// Generates every missing group round in one go, leaving existing rounds untouched.
// Rules: no matchup repeats across rounds 1–3, max one bye per team, and each
// required matchup lands in its chosen round (or any missing round when none is chosen).
// Returns an error message when the requirements can't be met.
export function generateGroupRounds(
  teamIds: string[],
  existingMatches: TAMatch[],
  required: RequiredMatchup[],
  teamName: (id: string) => string
): { rounds: GeneratedRound[] } | { error: string } {
  const existing = groupMatchesOf(existingMatches)
  const missing = missingGroupRounds(existing)
  if (missing.length === 0) return { error: `All ${GROUP_ROUNDS} group rounds already exist.` }

  const playedIn = new Map<string, number>()
  for (const m of existing) {
    if (m.team1_id && m.team2_id) playedIn.set(pairKey(m.team1_id, m.team2_id), m.round_number ?? 0)
  }
  const hadBye = new Set<string>()
  for (const ids of Array.from(byeTeamsByRound(teamIds, existing).values())) {
    for (const id of ids) hadBye.add(id)
  }

  // Validate the required matchups up front so the admin gets a precise error.
  const teamSet = new Set(teamIds)
  const seenPairs = new Set<string>()
  for (const req of required) {
    const label = `${teamName(req.team1_id)} vs ${teamName(req.team2_id)}`
    if (!teamSet.has(req.team1_id) || !teamSet.has(req.team2_id)) {
      return { error: `Required matchup ${label}: both teams must be approved teams of this event.` }
    }
    if (req.team1_id === req.team2_id) return { error: 'A team cannot play itself.' }
    const key = pairKey(req.team1_id, req.team2_id)
    const met = playedIn.get(key)
    if (met !== undefined) return { error: `Required matchup ${label} is impossible: they already play each other in Round ${met}.` }
    if (seenPairs.has(key)) return { error: `Required matchup ${label} was added twice.` }
    seenPairs.add(key)
    if (req.round !== null && !missing.includes(req.round)) {
      return { error: `Required matchup ${label}: Round ${req.round} already exists — pick ${missing.map(r => `Round ${r}`).join(' or ')}.` }
    }
  }
  for (const r of missing) {
    const fixed = required.filter(q => q.round === r).flatMap(q => [q.team1_id, q.team2_id])
    const dup = fixed.find((id, i) => fixed.indexOf(id) !== i)
    if (dup) return { error: `${teamName(dup)} has two required matchups in Round ${r}.` }
  }
  if (required.length > missing.length * Math.floor(teamIds.length / 2)) {
    return { error: 'More required matchups than there are matches left to play.' }
  }

  for (let attempt = 0; attempt < 2000; attempt++) {
    // Place "any round" requirements in a random missing round.
    const byRound = new Map<number, Pairing[]>(missing.map(r => [r, []]))
    let ok = true
    for (const req of shuffle(required)) {
      const options = req.round !== null ? [req.round] : shuffle(missing)
      const round = options.find(r =>
        (byRound.get(r) ?? []).every(p => ![p.team1_id, p.team2_id].some(id => id === req.team1_id || id === req.team2_id))
      )
      if (round === undefined) {
        ok = false
        break
      }
      byRound.get(round)?.push({ team1_id: req.team1_id, team2_id: req.team2_id })
    }
    if (!ok) continue

    const played = new Set(playedIn.keys())
    for (const p of required) played.add(pairKey(p.team1_id, p.team2_id))
    const byes = new Set(hadBye)
    const rounds: GeneratedRound[] = []
    for (const r of missing) {
      const fixedPairs = byRound.get(r) ?? []
      const fixedTeams = new Set(fixedPairs.flatMap(p => [p.team1_id, p.team2_id]))
      const free = teamIds.filter(id => !fixedTeams.has(id))
      const byeCandidates: Array<string | null> =
        teamIds.length % 2 === 1 ? shuffle(free.filter(id => !byes.has(id))) : [null]
      let result: GeneratedRound | null = null
      for (const bye of byeCandidates) {
        const pairs = pairUp(shuffle(free.filter(id => id !== bye)), played)
        if (pairs) {
          result = { round: r, pairings: shuffle([...fixedPairs, ...pairs]), bye }
          break
        }
      }
      if (!result) {
        ok = false
        break
      }
      for (const p of result.pairings) played.add(pairKey(p.team1_id, p.team2_id))
      if (result.bye) byes.add(result.bye)
      rounds.push(result)
    }
    if (ok) return { rounds }
  }
  return {
    error:
      required.length > 0
        ? 'No schedule fits these required matchups without repeating a matchup or giving a team a second bye. Remove or change a required matchup.'
        : 'No valid schedule exists without repeating a matchup (too few teams for 3 rounds).',
  }
}

function pairUp(pool: string[], played: Set<string>): Pairing[] | null {
  if (pool.length === 0) return []
  const [first, ...rest] = pool
  for (const candidate of shuffle(rest)) {
    if (played.has(pairKey(first, candidate))) continue
    const remaining = rest.filter(id => id !== candidate)
    const tail = pairUp(remaining, played)
    if (tail) return [{ team1_id: first, team2_id: candidate }, ...tail]
  }
  return null
}

// Stable pseudo-random number per team, so the "random" tiebreak doesn't
// reshuffle on every render and the server agrees with what the admin saw.
function seededRandom(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

// Group standings: game difference, then games won, then head-to-head, then random.
export function computeStandings(eventId: string, teamIds: string[], matches: TAMatch[]): Standing[] {
  const group = groupMatchesOf(matches)
  const map = new Map<string, Standing>()
  for (const id of teamIds) {
    map.set(id, { team_id: id, played: 0, gamesWon: 0, gamesLost: 0, diff: 0, byes: 0 })
  }
  for (const ids of Array.from(byeTeamsByRound(teamIds, group).values())) {
    for (const id of ids) {
      const s = map.get(id)
      if (s) s.byes++
    }
  }
  const scored = group.filter(isScored)
  for (const m of scored) {
    const a = m.team1_id ? map.get(m.team1_id) : undefined
    const b = m.team2_id ? map.get(m.team2_id) : undefined
    if (!a || !b || m.team1_score === null || m.team2_score === null) continue
    a.played++
    b.played++
    a.gamesWon += m.team1_score
    a.gamesLost += m.team2_score
    b.gamesWon += m.team2_score
    b.gamesLost += m.team1_score
    a.diff += m.team1_score - m.team2_score
    b.diff += m.team2_score - m.team1_score
  }

  const all = Array.from(map.values())
  const primary = (x: Standing, y: Standing) => y.diff - x.diff || y.gamesWon - x.gamesWon
  all.sort(primary)

  // Resolve each block of teams tied on diff + games won.
  const out: Standing[] = []
  let i = 0
  while (i < all.length) {
    let j = i + 1
    while (j < all.length && primary(all[i], all[j]) === 0) j++
    const block = all.slice(i, j)
    if (block.length > 1) {
      const ids = new Set(block.map(s => s.team_id))
      const h2h = new Map<string, number>(block.map(s => [s.team_id, 0]))
      for (const m of scored) {
        if (!m.team1_id || !m.team2_id || !ids.has(m.team1_id) || !ids.has(m.team2_id)) continue
        const d = (m.team1_score ?? 0) - (m.team2_score ?? 0)
        h2h.set(m.team1_id, (h2h.get(m.team1_id) ?? 0) + d)
        h2h.set(m.team2_id, (h2h.get(m.team2_id) ?? 0) - d)
      }
      block.sort(
        (x, y) =>
          (h2h.get(y.team_id) ?? 0) - (h2h.get(x.team_id) ?? 0) ||
          seededRandom(eventId + y.team_id) - seededRandom(eventId + x.team_id)
      )
    }
    out.push(...block)
    i = j
  }
  return out
}

// Finals pairings from the group standings: #1v#2 on court 1, #3v#4 on court 2, ...
// With an odd team count the last-ranked team has no finals match.
export function finalsPairings(standings: Standing[]): Pairing[] {
  const pairs: Pairing[] = []
  for (let k = 0; k + 1 < standings.length; k += 2) {
    pairs.push({ team1_id: standings[k].team_id, team2_id: standings[k + 1].team_id })
  }
  return pairs
}

export function finalLabel(matchOrder: number): string {
  if (matchOrder === 1) return 'Final'
  return `${ordinal(matchOrder * 2 - 1)} place`
}

// Final ranking comes ONLY from the finals: winner of match k = 2k-1, loser = 2k.
// Returns null until every finals match is scored.
export function finalRanking(teamIds: string[], matches: TAMatch[]): Placement[] | null {
  const finals = finalMatchesOf(matches)
  if (finals.length === 0 || !finals.every(isScored)) return null
  const out: Placement[] = []
  const placed = new Set<string>()
  for (const m of finals) {
    if (!m.team1_id || !m.team2_id || m.team1_score === null || m.team2_score === null) continue
    const order = m.match_order ?? 0
    const t1Won = m.team1_score > m.team2_score
    const winner = t1Won ? m.team1_id : m.team2_id
    const loser = t1Won ? m.team2_id : m.team1_id
    out.push({ rank: order * 2 - 1, team_id: winner }, { rank: order * 2, team_id: loser })
    placed.add(winner)
    placed.add(loser)
  }
  // Odd team count: the team without a finals match finishes last.
  for (const id of teamIds) {
    if (!placed.has(id)) out.push({ rank: out.length + 1, team_id: id })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export const signed = (n: number): string => (n > 0 ? `+${n}` : String(n))
