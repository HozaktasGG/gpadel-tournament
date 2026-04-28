// Pairing schedules for 12-player, 3-court Americano tournaments.
// All indices are 1-based and refer to the admin's player-input order.

export type Pair = [number, number]
export type Match = { court: number; team1: Pair; team2: Pair }

// Court Americano: players stay on the same court for rounds 1-3.
// Court 1 = indices 1..4 (A,B,C,D), Court 2 = 5..8, Court 3 = 9..12.
// R1 AB vs CD, R2 AC vs BD, R3 AD vs BC (standard 4-player round-robin doubles).
export function courtAmericanoRound(round: 1 | 2 | 3): Match[] {
  const matches: Match[] = []
  for (let c = 0; c < 3; c++) {
    const base = c * 4
    const A = base + 1
    const B = base + 2
    const C = base + 3
    const D = base + 4
    let team1: Pair, team2: Pair
    if (round === 1) {
      team1 = [A, B]; team2 = [C, D]
    } else if (round === 2) {
      team1 = [A, C]; team2 = [B, D]
    } else {
      team1 = [A, D]; team2 = [B, C]
    }
    matches.push({ court: c + 1, team1, team2 })
  }
  return matches
}

// Mix Americano: each of rounds 1-3 has 6 unique partnerships (no player is paired
// with the same partner twice across rounds 1-3). Hand-verified schedule.
const MIX_SCHEDULE: Match[][] = [
  // Round 1
  [
    { court: 1, team1: [1, 2],  team2: [3, 4]   },
    { court: 2, team1: [5, 6],  team2: [7, 8]   },
    { court: 3, team1: [9, 10], team2: [11, 12] },
  ],
  // Round 2
  [
    { court: 1, team1: [1, 5],  team2: [9, 2]   },
    { court: 2, team1: [3, 7],  team2: [11, 8]  },
    { court: 3, team1: [4, 10], team2: [6, 12]  },
  ],
  // Round 3
  [
    { court: 1, team1: [1, 11], team2: [3, 9]   },
    { court: 2, team1: [2, 8],  team2: [4, 6]   },
    { court: 3, team1: [5, 7],  team2: [10, 12] },
  ],
]

export function mixAmericanoRound(round: 1 | 2 | 3): Match[] {
  return MIX_SCHEDULE[round - 1]
}

// Round 4: rank-based grouping. rankedIndices[0] is #1, rankedIndices[11] is #12.
// Court 1 = ranks 1-4, Court 2 = ranks 5-8, Court 3 = ranks 9-12.
// Within each 4-group, pair (1st,4th) vs (2nd,3rd) for a balanced matchup.
export function round4Matches(rankedIndices: number[]): Match[] {
  if (rankedIndices.length !== 12) {
    throw new Error('Round 4 requires exactly 12 ranked players')
  }
  const matches: Match[] = []
  for (let c = 0; c < 3; c++) {
    const g = rankedIndices.slice(c * 4, c * 4 + 4)
    matches.push({
      court: c + 1,
      team1: [g[0], g[3]],
      team2: [g[1], g[2]],
    })
  }
  return matches
}

export function matchesForRound(
  mode: 'court' | 'mix',
  round: 1 | 2 | 3 | 4,
  rankedIndices?: number[]
): Match[] {
  if (round === 4) {
    if (!rankedIndices) throw new Error('Round 4 needs rankedIndices')
    return round4Matches(rankedIndices)
  }
  return mode === 'court' ? courtAmericanoRound(round) : mixAmericanoRound(round)
}
