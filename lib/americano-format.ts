// Court Americano formats: N regular rounds scored by point differential, then one
// finals round where courts are filled by the standings (C1 = ranks 1-4, ...).
// A started tournament keeps its own round count in tournament_rounds, so changing
// this config never affects a tournament that is already running.

export type AmericanoFormat = {
  name: string
  warmupMinutes: number
  regularRounds: number
  regularRoundMinutes: number
  finalsMinutes: number
  showSchedule: boolean
}

export const AMERICANO_FORMATS: Record<string, AmericanoFormat> = {
  // Original format: R1-R3 + R4 finals. Keep unchanged for existing events.
  Americano: {
    name: 'Americano',
    warmupMinutes: 0,
    regularRounds: 3,
    regularRoundMinutes: 20,
    finalsMinutes: 30,
    showSchedule: false,
  },
  'Americano 120': {
    name: 'Americano 120',
    warmupMinutes: 10,
    regularRounds: 4,
    regularRoundMinutes: 20,
    finalsMinutes: 30,
    showSchedule: true,
  },
}

export const AMERICANO_FORMAT_NAMES = Object.keys(AMERICANO_FORMATS)

export function americanoFormat(format: string | null | undefined): AmericanoFormat {
  return (format && AMERICANO_FORMATS[format]) || AMERICANO_FORMATS.Americano
}

export function totalRounds(f: AmericanoFormat) {
  return f.regularRounds + 1
}

export function totalMinutes(f: AmericanoFormat) {
  return f.warmupMinutes + f.regularRounds * f.regularRoundMinutes + f.finalsMinutes
}

export type ScheduleSlot = {
  kind: 'warmup' | 'round' | 'finals'
  label: string
  minutes: number
  start: string | null
  end: string | null
}

function parseClock(time: string | null | undefined): number | null {
  const m = time?.match(/(\d{1,2})[:.](\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function formatClock(total: number) {
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// Start/end clock times are filled in when the event time is parseable (e.g. "18:00").
export function americanoSchedule(f: AmericanoFormat, startTime?: string | null): ScheduleSlot[] {
  const slots: Omit<ScheduleSlot, 'start' | 'end'>[] = []
  if (f.warmupMinutes > 0) slots.push({ kind: 'warmup', label: 'Warm-up', minutes: f.warmupMinutes })
  for (let r = 1; r <= f.regularRounds; r++) {
    slots.push({ kind: 'round', label: `Round ${r}`, minutes: f.regularRoundMinutes })
  }
  slots.push({ kind: 'finals', label: `Round ${f.regularRounds + 1} · Finals`, minutes: f.finalsMinutes })

  let clock = parseClock(startTime)
  return slots.map(s => {
    if (clock === null) return { ...s, start: null, end: null }
    const start = formatClock(clock)
    clock += s.minutes
    return { ...s, start, end: formatClock(clock) }
  })
}

export type IdxPair = [number, number]
export type CourtMatch = { court: number; team1: IdxPair; team2: IdxPair }

const pairKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`)

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Regular rounds: random pairs on random courts, nobody gets the same partner twice.
// Player indices are 0-based.
export function generateRegularRounds(
  roundCount: number,
  playerCount = 12,
  rng: () => number = Math.random
): CourtMatch[][] {
  const courts = playerCount / 4
  const playerIdx = Array.from({ length: playerCount }, (_, i) => i)

  const generateRoundMatching = (used: Set<string>): IdxPair[] | null => {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const order = shuffle(playerIdx, rng)
      const pairs: IdxPair[] = []
      let ok = true
      for (let i = 0; i < playerCount; i += 2) {
        const a = order[i], b = order[i + 1]
        if (used.has(pairKey(a, b))) { ok = false; break }
        pairs.push([a, b])
      }
      if (ok) return pairs
    }
    return null
  }

  let roundPairs: IdxPair[][] | null = null
  for (let bigAttempt = 0; bigAttempt < 200; bigAttempt++) {
    const used = new Set<string>()
    const attempt: IdxPair[][] = []
    let ok = true
    for (let r = 0; r < roundCount; r++) {
      const m = generateRoundMatching(used)
      if (!m) { ok = false; break }
      m.forEach(([a, b]) => used.add(pairKey(a, b)))
      attempt.push(m)
    }
    if (ok) { roundPairs = attempt; break }
  }
  if (!roundPairs) throw new Error('Could not generate unique-partner schedule')

  return roundPairs.map(pairs => {
    const shuffledPairs = shuffle(pairs, rng)
    return Array.from({ length: courts }, (_, c) => ({
      court: c + 1,
      team1: shuffledPairs[c * 2],
      team2: shuffledPairs[c * 2 + 1],
    }))
  })
}

// Finals: ranked[0] is #1. Court 1 = ranks 1-4, Court 2 = 5-8, Court 3 = 9-12,
// paired (1st+4th) vs (2nd+3rd) within each court.
export function finalsMatches<T>(ranked: T[]): { court: number; team1: [T, T]; team2: [T, T] }[] {
  if (ranked.length !== 12) throw new Error('Expected 12 ranked players')
  return [0, 1, 2].map(c => {
    const base = c * 4
    return {
      court: c + 1,
      team1: [ranked[base], ranked[base + 3]],
      team2: [ranked[base + 1], ranked[base + 2]],
    }
  })
}

// Finals bonus by court; only the court placement counts, not the score margin.
export const FINALS_BONUS: Record<number, { winner: number; loser: number }> = {
  1: { winner: 80, loser: 50 },   // C1: 1-2 vs 3-4
  2: { winner: 30, loser: 10 },   // C2: 5-6 vs 7-8
  3: { winner: -10, loser: -25 }, // C3: 9-10 vs 11-12
}

type ScoredMatch<T> = {
  court_number: number
  team1_score: number | null
  team2_score: number | null
  team1: [T, T]
  team2: [T, T]
}

export function finalsPlacements<T>(match: ScoredMatch<T>) {
  const bonus = FINALS_BONUS[match.court_number]
  if (!bonus) return []
  const team1Won = (match.team1_score ?? 0) >= (match.team2_score ?? 0)
  const winners = team1Won ? match.team1 : match.team2
  const losers = team1Won ? match.team2 : match.team1
  const winnerRank = (match.court_number - 1) * 4 + 1
  const loserRank = (match.court_number - 1) * 4 + 3
  return [
    ...winners.map(player => ({ player, bonus: bonus.winner, rank: winnerRank })),
    ...losers.map(player => ({ player, bonus: bonus.loser, rank: loserRank })),
  ]
}
