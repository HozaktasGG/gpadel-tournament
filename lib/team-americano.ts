// Shared Team Americano logic (admin manager, API routes and the public live view).
// Format: N random group rounds drawn up front (no repeat opponents, max one bye per team),
// then a finals round pairing #1v#2, #3v#4, ... by group standings. The final ranking
// comes only from the finals. phase ('group' | 'final') is the source of truth for which
// matches are finals — never round_number.

import { type ScheduleSlot, withClockTimes } from './americano-format'

// ───────────────────────── Formats ─────────────────────────

export type TeamAmericanoFormat = {
  name: string
  groupRounds: number
  groupRoundMinutes: number
  finalsMinutes: number
  warmupMinutes: 0
}

// Both structures last 90 minutes. 'Team Americano' is the original (existing events).
export const TEAM_AMERICANO_FORMATS: Record<string, TeamAmericanoFormat> = {
  'Team Americano': { name: 'Team Americano', groupRounds: 3, groupRoundMinutes: 20, finalsMinutes: 30, warmupMinutes: 0 },
  'Team Americano 4x15': { name: 'Team Americano 4x15', groupRounds: 4, groupRoundMinutes: 15, finalsMinutes: 30, warmupMinutes: 0 },
}

export const TEAM_AMERICANO_FORMAT_NAMES = Object.keys(TEAM_AMERICANO_FORMATS)
export const DEFAULT_TA_FORMAT = 'Team Americano'

export const isTeamAmericano = (format: string | null | undefined): boolean =>
  !!format && Object.prototype.hasOwnProperty.call(TEAM_AMERICANO_FORMATS, format)

export const teamAmericanoFormat = (format: string | null | undefined): TeamAmericanoFormat =>
  (format && isTeamAmericano(format) ? TEAM_AMERICANO_FORMATS[format] : null) ?? TEAM_AMERICANO_FORMATS[DEFAULT_TA_FORMAT]

export const taTotalMinutes = (f: TeamAmericanoFormat): number =>
  f.warmupMinutes + f.groupRounds * f.groupRoundMinutes + f.finalsMinutes

// "90 min · 3×20 + Final 30"
export const taStructureLabel = (f: TeamAmericanoFormat): string =>
  `${taTotalMinutes(f)} min · ${f.groupRounds}×${f.groupRoundMinutes} + Final ${f.finalsMinutes}`

// Dropdown label: "Team Americano 4x15 (90 min · 4×15 + Final 30)"; other formats unchanged.
export const formatOptionLabel = (format: string): string =>
  isTeamAmericano(format) ? `${format} (${taStructureLabel(TEAM_AMERICANO_FORMATS[format])})` : format

// Finals are stored with round_number = groupRounds + 1 (informational only).
export const taFinalsRound = (f: TeamAmericanoFormat): number => f.groupRounds + 1

export const DEFAULT_COURTS = 5

// Round 1..groupRounds, then Finals. Clock times from events.time (e.g. "18:30").
export function teamAmericanoSchedule(f: TeamAmericanoFormat, startTime?: string | null): ScheduleSlot[] {
  const slots: Omit<ScheduleSlot, 'start' | 'end'>[] = []
  for (let r = 1; r <= f.groupRounds; r++) {
    slots.push({ kind: 'round', label: `Round ${r}`, minutes: f.groupRoundMinutes })
  }
  slots.push({ kind: 'finals', label: 'Finals', minutes: f.finalsMinutes })
  return withClockTimes(slots, startTime)
}

// "18:30–18:50 · 20 min" or "20 min" when the event has no parseable time.
export function slotLabel(slots: ScheduleSlot[], kind: 'round' | 'finals', round?: number): string {
  const slot = kind === 'finals' ? slots.find(s => s.kind === 'finals') : slots.filter(s => s.kind === 'round')[(round ?? 1) - 1]
  if (!slot) return ''
  return slot.start ? `${slot.start}–${slot.end} · ${slot.minutes} min` : `${slot.minutes} min`
}

// ───────────────────────── Matches ─────────────────────────

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
  wins: number
  draws: number
  losses: number
  gamesWon: number // GF
  gamesLost: number // GA
  diff: number
  byes: number
}

export type Placement = { rank: number; team_id: string }

// Shape returned by /api/team-americano/live (public, read-only).
export type LiveTeam = { id: string; team_name: string; players: string[] }
export type LiveState = {
  event: { id: string; name: string; date: string; time: string | null; format: string | null } | null
  teams: LiveTeam[]
  matches: TAMatch[]
}

export const FINALS_DRAW_MESSAGE = 'Draw not allowed — play golden point / tiebreak.'

export const isScored = (m: TAMatch): boolean => m.team1_score !== null && m.team2_score !== null

export const groupMatchesOf = (matches: TAMatch[]): TAMatch[] => matches.filter(m => m.phase === 'group')

export const finalMatchesOf = (matches: TAMatch[]): TAMatch[] =>
  matches.filter(m => m.phase === 'final').sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))

export const roundMatches = (matches: TAMatch[], round: number): TAMatch[] =>
  groupMatchesOf(matches)
    .filter(m => m.round_number === round)
    .sort((a, b) => (a.match_order ?? 0) - (b.match_order ?? 0))

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
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

// Group rounds (1..groupRounds) that have no matches yet.
export function missingGroupRounds(matches: TAMatch[], groupRounds: number): number[] {
  const existing = new Set(groupMatchesOf(matches).map(m => m.round_number ?? 0))
  return Array.from({ length: groupRounds }, (_, i) => i + 1).filter(r => !existing.has(r))
}

// Circle-method round robin for an even number of teams: shuffle, fix the first
// team, rotate the rest. Returns the first `rounds` rounds (needs rounds <= N-1),
// so no opponent ever repeats. Match order within a round (= court) is shuffled.
export function circleRounds(teamIds: string[], rounds: number, rng: () => number = Math.random): Pairing[][] | null {
  const n = teamIds.length
  if (n < 2 || n % 2 === 1 || rounds > n - 1) return null
  const order = shuffle(teamIds, rng)
  const fixed = order[0]
  let rest = order.slice(1)
  const out: Pairing[][] = []
  for (let r = 0; r < rounds; r++) {
    const line = [fixed, ...rest]
    const pairs: Pairing[] = []
    for (let i = 0; i < n / 2; i++) {
      const [a, b] = rng() < 0.5 ? [line[i], line[n - 1 - i]] : [line[n - 1 - i], line[i]]
      pairs.push({ team1_id: a, team2_id: b })
    }
    out.push(shuffle(pairs, rng))
    rest = [rest[rest.length - 1], ...rest.slice(0, -1)]
  }
  return out
}

// Generates every missing group round in one go, leaving existing rounds untouched.
// Even team count, nothing generated yet and no required matchups → circle method.
// Otherwise (odd count, partial rounds, required matchups) → randomized search.
// Rules: no opponent repeats across group rounds, max one bye per team, and each
// required matchup lands in its chosen round (or any missing round when none is chosen).
export function generateGroupRounds(
  teamIds: string[],
  existingMatches: TAMatch[],
  required: RequiredMatchup[],
  teamName: (id: string) => string,
  groupRounds: number,
  rng: () => number = Math.random
): { rounds: GeneratedRound[] } | { error: string } {
  const existing = groupMatchesOf(existingMatches)
  const missing = missingGroupRounds(existing, groupRounds)
  if (missing.length === 0) return { error: `All ${groupRounds} group rounds already exist.` }

  if (existing.length === 0 && required.length === 0 && teamIds.length % 2 === 0) {
    const circle = circleRounds(teamIds, groupRounds, rng)
    if (circle) return { rounds: circle.map((pairings, i) => ({ round: i + 1, pairings, bye: null })) }
    return {
      error: `${teamIds.length} teams can play at most ${teamIds.length - 1} rounds without repeating an opponent — this format has ${groupRounds}.`,
    }
  }

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
      return { error: `Required matchup ${label}: Round ${req.round} isn't available — pick ${missing.map(r => `Round ${r}`).join(' or ')}.` }
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
    for (const req of shuffle(required, rng)) {
      const options = req.round !== null ? [req.round] : shuffle(missing, rng)
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
        teamIds.length % 2 === 1 ? shuffle(free.filter(id => !byes.has(id)), rng) : [null]
      let result: GeneratedRound | null = null
      for (const bye of byeCandidates) {
        const pairs = pairUp(shuffle(free.filter(id => id !== bye), rng), played, rng)
        if (pairs) {
          result = { round: r, pairings: shuffle([...fixedPairs, ...pairs], rng), bye }
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
        ? 'No schedule fits these required matchups without repeating an opponent or giving a team a second bye. Remove or change a required matchup.'
        : `No valid schedule exists without repeating an opponent (too few teams for ${groupRounds} rounds).`,
  }
}

function pairUp(pool: string[], played: Set<string>, rng: () => number): Pairing[] | null {
  if (pool.length === 0) return []
  const [first, ...rest] = pool
  for (const candidate of shuffle(rest, rng)) {
    if (played.has(pairKey(first, candidate))) continue
    const remaining = rest.filter(id => id !== candidate)
    const tail = pairUp(remaining, played, rng)
    if (tail) return [{ team1_id: first, team2_id: candidate }, ...tail]
  }
  return null
}

// ───────────────────────── Standings ─────────────────────────

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

export type StandingsResult = {
  standings: Standing[]
  // Blocks of teams (as positions start..end, inclusive) still tied after
  // head-to-head, whose order came from the seeded random draw.
  randomTies: { start: number; end: number; teamIds: string[] }[]
}

// Group standings: wins → game difference → games won → head-to-head → seeded random.
export function rankStandings(eventId: string, teamIds: string[], matches: TAMatch[]): StandingsResult {
  const group = groupMatchesOf(matches)
  const map = new Map<string, Standing>()
  for (const id of teamIds) {
    map.set(id, { team_id: id, played: 0, wins: 0, draws: 0, losses: 0, gamesWon: 0, gamesLost: 0, diff: 0, byes: 0 })
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
    const s1 = m.team1_score
    const s2 = m.team2_score
    a.played++
    b.played++
    a.gamesWon += s1
    a.gamesLost += s2
    b.gamesWon += s2
    b.gamesLost += s1
    a.diff += s1 - s2
    b.diff += s2 - s1
    if (s1 > s2) {
      a.wins++
      b.losses++
    } else if (s2 > s1) {
      b.wins++
      a.losses++
    } else {
      a.draws++
      b.draws++
    }
  }

  const all = Array.from(map.values())
  const primary = (x: Standing, y: Standing) => y.wins - x.wins || y.diff - x.diff || y.gamesWon - x.gamesWon
  all.sort(primary)

  // Resolve each block of teams tied on wins + diff + games won.
  const out: Standing[] = []
  const randomTies: StandingsResult['randomTies'] = []
  let i = 0
  while (i < all.length) {
    let j = i + 1
    while (j < all.length && primary(all[i], all[j]) === 0) j++
    const block = all.slice(i, j)
    if (block.length > 1) {
      // Head-to-head mini-table among the tied teams: wins, then game difference.
      const ids = new Set(block.map(s => s.team_id))
      const h2h = new Map<string, { w: number; d: number }>(block.map(s => [s.team_id, { w: 0, d: 0 }]))
      for (const m of scored) {
        if (!m.team1_id || !m.team2_id || !ids.has(m.team1_id) || !ids.has(m.team2_id)) continue
        const d = (m.team1_score ?? 0) - (m.team2_score ?? 0)
        const r1 = h2h.get(m.team1_id)!
        const r2 = h2h.get(m.team2_id)!
        r1.d += d
        r2.d -= d
        if (d > 0) r1.w++
        else if (d < 0) r2.w++
      }
      const byH2h = (x: Standing, y: Standing) => {
        const hx = h2h.get(x.team_id)!
        const hy = h2h.get(y.team_id)!
        return hy.w - hx.w || hy.d - hx.d
      }
      block.sort(
        (x, y) => byH2h(x, y) || seededRandom(eventId + y.team_id) - seededRandom(eventId + x.team_id)
      )
      // Record sub-blocks still level after head-to-head (ordered by the random draw).
      let a = 0
      while (a < block.length) {
        let b = a + 1
        while (b < block.length && byH2h(block[a], block[b]) === 0) b++
        if (b - a > 1) {
          randomTies.push({ start: i + a, end: i + b - 1, teamIds: block.slice(a, b).map(s => s.team_id) })
        }
        a = b
      }
    }
    out.push(...block)
    i = j
  }
  return { standings: out, randomTies }
}

export const computeStandings = (eventId: string, teamIds: string[], matches: TAMatch[]): Standing[] =>
  rankStandings(eventId, teamIds, matches).standings

// A random tie only matters if it changes the finals pairings, i.e. the tied block
// spans more than one finals pair (#1/#2, #3/#4, ...). A tie between #1 and #2 doesn't.
export function tiesNeedingDecision(result: StandingsResult): StandingsResult['randomTies'] {
  return result.randomTies.filter(t => Math.floor(t.start / 2) !== Math.floor(t.end / 2))
}

// Validates an admin-chosen seeding order: same teams, and only teams inside a
// random-tie block may be reordered (within that block).
export function isValidTieOrder(result: StandingsResult, order: string[]): boolean {
  const { standings, randomTies } = result
  if (order.length !== standings.length || new Set(order).size !== order.length) return false
  for (let p = 0; p < standings.length; p++) {
    const tie = randomTies.find(t => p >= t.start && p <= t.end)
    if (tie ? !tie.teamIds.includes(order[p]) : order[p] !== standings[p].team_id) return false
  }
  return true
}

// ───────────────────────── Finals ─────────────────────────

// Finals pairings from the seeding order: #1v#2 on court 1, #3v#4 on court 2, ...
// With an odd team count the last-ranked team has no finals match.
export function finalsPairings(seededTeamIds: string[]): Pairing[] {
  const pairs: Pairing[] = []
  for (let k = 0; k + 1 < seededTeamIds.length; k += 2) {
    pairs.push({ team1_id: seededTeamIds[k], team2_id: seededTeamIds[k + 1] })
  }
  return pairs
}

export type FinalsDecision =
  | { status: 'not-ready'; reason: string }
  | { status: 'exists' }
  | { status: 'needs-decision'; ties: StandingsResult['randomTies']; result: StandingsResult }
  | { status: 'ready'; pairings: Pairing[]; result: StandingsResult }

// Whether finals can be (auto-)generated right now, and with which pairings.
export function finalsDecision(
  eventId: string,
  teamIds: string[],
  matches: TAMatch[],
  groupRounds: number,
  order?: string[]
): FinalsDecision {
  if (finalMatchesOf(matches).length > 0) return { status: 'exists' }
  if (missingGroupRounds(matches, groupRounds).length > 0) {
    return { status: 'not-ready', reason: `Play all ${groupRounds} group rounds first.` }
  }
  if (!groupMatchesOf(matches).every(isScored)) return { status: 'not-ready', reason: 'All group matches must be scored.' }
  const result = rankStandings(eventId, teamIds, matches)
  if (order) {
    if (!isValidTieOrder(result, order)) {
      return { status: 'not-ready', reason: 'The standings changed — refresh and confirm the order again.' }
    }
    return { status: 'ready', pairings: finalsPairings(order), result }
  }
  const ties = tiesNeedingDecision(result)
  if (ties.length > 0) return { status: 'needs-decision', ties, result }
  return { status: 'ready', pairings: finalsPairings(result.standings.map(s => s.team_id)), result }
}

export function finalLabel(matchOrder: number): string {
  if (matchOrder === 1) return 'Final'
  return `${ordinal(matchOrder * 2 - 1)} place`
}

// Final ranking comes ONLY from the finals: winner of court k = 2k-1, loser = 2k.
// Group-round scores are never added. Returns null until every finals match is scored.
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
