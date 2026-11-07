// Offline simulation of the Team Americano logic (no database).
// Run: node scripts/test-team-americano.mjs
// Uses Node's built-in TypeScript type stripping to import lib/team-americano.ts directly.

import { registerHooks } from 'node:module'

// lib files import each other without an extension ('./americano-format'); resolve to .ts.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(specifier + '.ts', context)
      } catch {}
    }
    return next(specifier, context)
  },
})

const ta = await import('../lib/team-americano.ts')
const {
  TEAM_AMERICANO_FORMATS,
  computeStandings,
  finalRanking,
  finalsDecision,
  generateGroupRounds,
  isTeamAmericano,
  isValidTieOrder,
  pairKey,
  rankStandings,
  taFinalsRound,
  taStructureLabel,
  teamAmericanoSchedule,
} = ta

let failures = 0
let checks = 0
function check(cond, msg) {
  checks++
  if (!cond) {
    failures++
    console.error('  ✗ ' + msg)
  }
}
function section(title) {
  console.log('\n— ' + title)
}

// Small seeded RNG (mulberry32) so failures are reproducible.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TEAMS = ['A', 'B', 'C', 'D', 'E', 'F']
const name = id => `Team ${id}`
let idSeq = 0
const match = (phase, round, order, t1, t2, s1 = null, s2 = null) => ({
  id: `m${++idSeq}`,
  phase,
  round_number: round,
  team1_id: t1,
  team2_id: t2,
  team1_score: s1,
  team2_score: s2,
  winner_id: s1 === null || s1 === s2 ? null : s1 > s2 ? t1 : t2,
  match_order: order,
})

// Turns generated rounds into match rows (what generate-rounds inserts).
const toMatches = rounds =>
  rounds.flatMap(r => r.pairings.map((p, i) => match('group', r.round, i + 1, p.team1_id, p.team2_id)))

// Mirrors insertFinals(): phase 'final', round_number groupRounds + 1, court = match_order.
const finalsRows = (format, pairings) =>
  pairings.map((p, i) => match('final', taFinalsRound(format), i + 1, p.team1_id, p.team2_id))

const SEEDS = 2000

for (const [fname, format] of Object.entries(TEAM_AMERICANO_FORMATS)) {
  console.log(`\n================ ${fname} — ${taStructureLabel(format)} ================`)
  check(isTeamAmericano(fname), `${fname} is recognised as Team Americano`)
  check(format.warmupMinutes === 0, 'no warm-up')
  check(format.groupRounds * format.groupRoundMinutes + format.finalsMinutes === 90, 'total is 90 minutes')

  section(`Pairings over ${SEEDS} seeds (6 teams, 3 courts)`)
  let opponentsSeen = new Set()
  let courtFirst = new Map()
  for (let seed = 1; seed <= SEEDS; seed++) {
    const res = generateGroupRounds(TEAMS, [], [], name, format.groupRounds, rng(seed))
    if ('error' in res) {
      check(false, `seed ${seed}: ${res.error}`)
      continue
    }
    check(res.rounds.length === format.groupRounds, `seed ${seed}: ${format.groupRounds} rounds`)
    const seen = new Set()
    for (const r of res.rounds) {
      check(r.pairings.length === 3, `seed ${seed} R${r.round}: 3 matches (one per court)`)
      check(r.bye === null, `seed ${seed} R${r.round}: no bye`)
      const playing = r.pairings.flatMap(p => [p.team1_id, p.team2_id])
      check(new Set(playing).size === 6, `seed ${seed} R${r.round}: all 6 teams play exactly once`)
      for (const p of r.pairings) {
        const k = pairKey(p.team1_id, p.team2_id)
        check(!seen.has(k), `seed ${seed}: repeated opponent ${k}`)
        seen.add(k)
        opponentsSeen.add(k)
      }
      const c1 = pairKey(r.pairings[0].team1_id, r.pairings[0].team2_id)
      courtFirst.set(c1, (courtFirst.get(c1) ?? 0) + 1)
    }
  }
  check(opponentsSeen.size === 15, `all 15 possible matchups occur across seeds (got ${opponentsSeen.size})`)
  check(courtFirst.size === 15, `court 1 assignment is random (${courtFirst.size}/15 matchups seen on court 1)`)
  console.log(`  ${SEEDS} schedules, no repeated opponents; ${opponentsSeen.size}/15 matchups seen; court 1 varies.`)

  section('Fallback search (required matchup) also never repeats')
  for (let seed = 1; seed <= 300; seed++) {
    const res = generateGroupRounds(TEAMS, [], [{ team1_id: 'A', team2_id: 'B', round: 2 }], name, format.groupRounds, rng(seed))
    if ('error' in res) {
      check(false, `required seed ${seed}: ${res.error}`)
      continue
    }
    const seen = new Set()
    for (const r of res.rounds) for (const p of r.pairings) {
      const k = pairKey(p.team1_id, p.team2_id)
      check(!seen.has(k), `required seed ${seed}: repeat ${k}`)
      seen.add(k)
    }
    const r2 = res.rounds.find(r => r.round === 2)
    check(r2.pairings.some(p => pairKey(p.team1_id, p.team2_id) === pairKey('A', 'B')), `required seed ${seed}: A–B in round 2`)
  }
  console.log('  300 schedules with a required matchup: OK')

  section('Time slots from events.time = 18:30')
  const slots = teamAmericanoSchedule(format, '18:30')
  const got = slots.map(s => `${s.label} ${s.start}–${s.end}`)
  const expected =
    format.groupRounds === 3
      ? ['Round 1 18:30–18:50', 'Round 2 18:50–19:10', 'Round 3 19:10–19:30', 'Finals 19:30–20:00']
      : ['Round 1 18:30–18:45', 'Round 2 18:45–19:00', 'Round 3 19:00–19:15', 'Round 4 19:15–19:30', 'Finals 19:30–20:00']
  check(JSON.stringify(got) === JSON.stringify(expected), `slots ${JSON.stringify(got)}`)
  console.log('  ' + got.join(' | '))
  check(teamAmericanoSchedule(format, null).every(s => s.start === null), 'no time → no clock')

  section('Full tournament: finals seeding, phase/round_number, final ranking ignores round scores')
  for (let seed = 1; seed <= 500; seed++) {
    const r = rng(seed * 7919)
    const res = generateGroupRounds(TEAMS, [], [], name, format.groupRounds, r)
    let matches = toMatches(res.rounds)
    // Random game scores (draws allowed in groups).
    matches = matches.map(m => {
      const s1 = Math.floor(r() * 7)
      const s2 = Math.floor(r() * 7)
      return { ...m, team1_score: s1, team2_score: s2 }
    })
    let d = finalsDecision(`ev${seed}`, TEAMS, matches, format.groupRounds)
    if (d.status === 'needs-decision') {
      // Admin accepts the random draw.
      const order = d.result.standings.map(s => s.team_id)
      d = finalsDecision(`ev${seed}`, TEAMS, matches, format.groupRounds, order)
    }
    if (d.status !== 'ready') {
      check(false, `seed ${seed}: finals not ready (${d.status})`)
      continue
    }
    const st = d.result.standings.map(s => s.team_id)
    check(d.pairings.length === 3, `seed ${seed}: 3 finals`)
    check(
      d.pairings[0].team1_id === st[0] && d.pairings[0].team2_id === st[1] &&
        d.pairings[1].team1_id === st[2] && d.pairings[1].team2_id === st[3] &&
        d.pairings[2].team1_id === st[4] && d.pairings[2].team2_id === st[5],
      `seed ${seed}: seeding #1v#2 / #3v#4 / #5v#6`
    )
    const finals = finalsRows(format, d.pairings)
    check(finals.every(f => f.phase === 'final' && f.round_number === format.groupRounds + 1), `seed ${seed}: finals phase/round_number`)
    // Standings must not change once finals exist (finals are not group matches).
    const withFinals = [...matches, ...finals]
    check(
      JSON.stringify(computeStandings(`ev${seed}`, TEAMS, withFinals)) === JSON.stringify(d.result.standings),
      `seed ${seed}: finals don't affect group standings`
    )
    check(finalsDecision(`ev${seed}`, TEAMS, withFinals, format.groupRounds).status === 'exists', `seed ${seed}: no second finals`)
    // Upsets on every court: the lower seed wins each final.
    const played = withFinals.map(m => (m.phase === 'final' ? { ...m, team1_score: 3, team2_score: 6 } : m))
    const ranking = finalRanking(TEAMS, played)
    const expectedRanking = [st[1], st[0], st[3], st[2], st[5], st[4]]
    check(
      JSON.stringify(ranking.map(p => p.team_id)) === JSON.stringify(expectedRanking),
      `seed ${seed}: final ranking = finals placement only`
    )
    check(ranking[0].team_id === st[1] && ranking[0].rank === 1, `seed ${seed}: court 1 winner is champion`)
  }
  console.log('  500 simulated tournaments: seeding, phase, round_number and ranking OK')
}

// ───────────── Hand-built tie scenarios (format-independent) ─────────────
console.log('\n================ Tie-break order ================')
const F = TEAM_AMERICANO_FORMATS['Team Americano']
const G = (r, o, t1, t2, s1, s2) => match('group', r, o, t1, t2, s1, s2)

section('1) Wins beat game difference')
{
  // A: 2 wins, small margins. B: 1 win + 1 draw but huge diff. A must be above B.
  const ms = [
    G(1, 1, 'A', 'C', 4, 3), G(1, 2, 'B', 'D', 9, 0), G(1, 3, 'E', 'F', 2, 2),
    G(2, 1, 'A', 'E', 4, 3), G(2, 2, 'B', 'F', 3, 3), G(2, 3, 'C', 'D', 1, 1),
    G(3, 1, 'A', 'F', 0, 9), G(3, 2, 'B', 'E', 5, 5), G(3, 3, 'C', 'D', 0, 0),
  ]
  const st = computeStandings('ev', TEAMS, ms)
  const a = st.findIndex(s => s.team_id === 'A')
  const b = st.findIndex(s => s.team_id === 'B')
  const A = st[a]
  check(A.wins === 2 && A.losses === 1 && A.draws === 0, `A W/D/L = 2/0/1 (got ${A.wins}/${A.draws}/${A.losses})`)
  check(A.gamesWon === 8 && A.gamesLost === 15 && A.diff === -7, `A GF/GA/Diff = 8/15/-7 (got ${A.gamesWon}/${A.gamesLost}/${A.diff})`)
  check(a < b, `A (2W, diff ${A.diff}) above B (1W, diff ${st[b].diff})`)
  console.log('  ' + st.map(s => `${s.team_id}(${s.wins}W ${s.diff >= 0 ? '+' : ''}${s.diff})`).join(' > '))
}

section('2) Same wins → game difference; same diff → games won')
{
  const ms = [
    G(1, 1, 'A', 'D', 6, 2), G(1, 2, 'B', 'E', 5, 1), G(1, 3, 'C', 'F', 9, 5),
  ]
  // A, B, C: 1 win, diff +4 each; games won 6 / 5 / 9 → C, A, B.
  const st = computeStandings('ev', TEAMS, ms).map(s => s.team_id)
  check(JSON.stringify(st.slice(0, 3)) === JSON.stringify(['C', 'A', 'B']), `games won order C,A,B (got ${st.slice(0, 3)})`)
  const ms2 = [G(1, 1, 'A', 'D', 6, 2), G(1, 2, 'B', 'E', 6, 0), G(1, 3, 'C', 'F', 1, 1)]
  const st2 = computeStandings('ev', TEAMS, ms2).map(s => s.team_id)
  check(st2[0] === 'B' && st2[1] === 'A', `diff order B(+6) > A(+4) (got ${st2.slice(0, 2)})`)
  console.log('  games-won order: ' + st.slice(0, 3).join(' > ') + '   diff order: ' + st2.slice(0, 2).join(' > '))
}

section('3) Same wins, diff, games won → head-to-head')
{
  // A beat B 5–3; both finish 2W, diff +2, GF 13 → A above B regardless of random.
  const ms = [
    G(1, 1, 'A', 'B', 5, 3), G(1, 2, 'C', 'D', 4, 4), G(1, 3, 'E', 'F', 4, 4),
    G(2, 1, 'A', 'C', 4, 6), G(2, 2, 'B', 'D', 6, 4), G(2, 3, 'E', 'F', 4, 4),
    G(3, 1, 'A', 'E', 4, 2), G(3, 2, 'B', 'F', 4, 2), G(3, 3, 'C', 'D', 4, 4),
  ]
  for (const ev of ['ev1', 'ev2', 'ev3', 'ev4', 'ev5', 'ev6', 'ev7', 'ev8']) {
    const st = computeStandings(ev, TEAMS, ms)
    const A = st.find(s => s.team_id === 'A')
    const B = st.find(s => s.team_id === 'B')
    check(A.wins === B.wins && A.diff === B.diff && A.gamesWon === B.gamesWon, 'A and B level before head-to-head')
    check(st.findIndex(s => s.team_id === 'A') < st.findIndex(s => s.team_id === 'B'), `${ev}: A above B by head-to-head`)
  }
  console.log('  A beats B on head-to-head for 8 different event seeds')
}

section('4) Still level after head-to-head → seeded random + admin decision')
{
  // Everyone draws 3–3 in every round: all six level; nobody can be separated.
  const res = generateGroupRounds(TEAMS, [], [], name, 3, rng(42))
  const ms = toMatches(res.rounds).map(m => ({ ...m, team1_score: 3, team2_score: 3 }))
  const r1 = rankStandings('evX', TEAMS, ms)
  const r2 = rankStandings('evX', TEAMS, ms)
  check(JSON.stringify(r1.standings) === JSON.stringify(r2.standings), 'random tiebreak is stable for the same event')
  check(r1.randomTies.length === 1 && r1.randomTies[0].teamIds.length === 6, 'one 6-team random tie reported')
  const d = finalsDecision('evX', TEAMS, ms, 3)
  check(d.status === 'needs-decision', `auto-finals blocked, admin must decide (got ${d.status})`)
  const draw = r1.standings.map(s => s.team_id)
  const swapped = [draw[1], draw[0], ...draw.slice(2)]
  check(isValidTieOrder(r1, swapped), 'admin may reorder teams inside the tie')
  const d2 = finalsDecision('evX', TEAMS, ms, 3, swapped)
  check(d2.status === 'ready' && d2.pairings[0].team1_id === draw[1], 'admin order is used for seeding')
  console.log('  6-way tie → needs-decision; random order stable; admin order accepted')

  // Tie only inside one finals pair (#1/#2) doesn't change pairings → no decision needed.
  const ms3 = [
    G(1, 1, 'A', 'C', 6, 0), G(1, 2, 'B', 'D', 6, 0), G(1, 3, 'E', 'F', 3, 2),
    G(2, 1, 'A', 'E', 6, 0), G(2, 2, 'B', 'F', 6, 0), G(2, 3, 'C', 'D', 2, 1),
    G(3, 1, 'A', 'F', 1, 1), G(3, 2, 'B', 'E', 1, 1), G(3, 3, 'C', 'D', 3, 1),
  ]
  const r3 = rankStandings('evY', TEAMS, ms3)
  check(r3.randomTies.length === 1 && r3.randomTies[0].start === 0 && r3.randomTies[0].end === 1, 'A/B tied for #1/#2 (random)')
  check(finalsDecision('evY', TEAMS, ms3, 3).status === 'ready', 'tie within #1/#2 → finals still auto-generate')
  console.log('  tie only between #1 and #2 → finals generated automatically (same final either way)')

  // Invalid admin order: moving a non-tied team is rejected.
  const bad = [...r3.standings.map(s => s.team_id)]
  ;[bad[2], bad[3]] = [bad[3], bad[2]]
  check(!isValidTieOrder(r3, bad), 'reordering non-tied teams is rejected')
}

section('Odd team count fallback (5 teams) still never repeats, max one bye')
{
  const five = TEAMS.slice(0, 5)
  for (let seed = 1; seed <= 300; seed++) {
    const res = generateGroupRounds(five, [], [], name, 3, rng(seed))
    if ('error' in res) {
      check(false, `5 teams seed ${seed}: ${res.error}`)
      continue
    }
    const seen = new Set()
    const byes = res.rounds.map(r => r.bye)
    check(new Set(byes).size === byes.length, `5 teams seed ${seed}: no team gets two byes`)
    for (const r of res.rounds) for (const p of r.pairings) {
      const k = pairKey(p.team1_id, p.team2_id)
      check(!seen.has(k), `5 teams seed ${seed}: repeat ${k}`)
      seen.add(k)
    }
  }
  console.log('  300 schedules OK')
}

section('Too many rounds for the team count is a clear error')
{
  const res = generateGroupRounds(['A', 'B', 'C', 'D'], [], [], name, 4, rng(1))
  check('error' in res, '4 teams × 4 rounds is rejected')
  console.log('  ' + res.error)
}

console.log(`\n${checks} checks, ${failures} failed`)
process.exit(failures ? 1 : 0)
