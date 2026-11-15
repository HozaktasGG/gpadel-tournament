// Offline checks of the Lights Out logic (no database).
// Run: node scripts/test-lights-out.mjs
import { registerHooks } from 'node:module'

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

const lo = await import('../lib/lights-out.ts')

let failures = 0
let checks = 0
function check(cond, msg) {
  checks++
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Formats
check(lo.isLightsOut('Lights Out 90') && lo.isLightsOut('Lights Out 120'), 'both variants are Lights Out')
check(!lo.isLightsOut('Team Americano') && !lo.isLightsOut(null), 'other formats are not Lights Out')
check(lo.loTotalMinutes(lo.lightsOutFormat('Lights Out 90')) === 90, '90 variant lasts 90 min')
check(lo.loTotalMinutes(lo.lightsOutFormat('Lights Out 120')) === 120, '120 variant lasts 120 min')
check(lo.lightsOutFormat('Lights Out 90').rounds === 4 && lo.lightsOutFormat('Lights Out 120').rounds === 6, 'round counts')
const slots = lo.lightsOutSchedule(lo.lightsOutFormat('Lights Out 120'), '18:30')
check(slots.length === 7 && slots[0].start === '18:30' && slots[6].end === '20:30', 'schedule clock times')

// Points table
const pt = n => lo.defaultPointsTable(n).map(p => [p.winner, p.loser])
check(eq(pt(2), [[80, 50], [-10, -25]]), '2 courts table')
check(eq(pt(3), [[80, 50], [30, 10], [-10, -25]]), '3 courts table = Court Americano')
check(eq(pt(4), [[80, 50], [30, 10], [10, 0], [-10, -25]]), '4 courts table')
check(eq(pt(6), [[80, 50], [30, 10], [10, 0], [10, 0], [10, 0], [-10, -25]]), '6 courts table')
check(lo.parsePointsTable(lo.defaultPointsTable(4), 4) !== null, 'valid table parses')
check(lo.parsePointsTable(lo.defaultPointsTable(3), 4) === null, 'wrong court count rejected')
check(lo.parsePointsTable([{ court: 1, winner: 1.5, loser: 0 }, { court: 2, winner: 0, loser: 0 }], 2) === null, 'non-integer rejected')

// Draw
const teams = n => Array.from({ length: n }, (_, i) => 't' + (i + 1))
for (const courts of [2, 3, 4, 7, 12]) {
  for (let i = 0; i < 50; i++) {
    const r = lo.drawCourts(teams(courts * 2), courts)
    const ids = 'draw' in r ? r.draw.flatMap(d => [d.team1_id, d.team2_id]) : []
    check('draw' in r && r.draw.length === courts && new Set(ids).size === courts * 2, courts + ' courts: every team drawn once')
    check('draw' in r && r.draw.every((d, k) => d.court === k + 1), courts + ' courts: courts numbered 1..N')
  }
}
check('error' in lo.drawCourts(teams(7), 4), '7 teams on 4 courts refused')
check('error' in lo.drawCourts(teams(9), 4), '9 teams on 4 courts refused')
check('error' in lo.drawCourts(teams(2), 1), '1 court refused')
check('error' in lo.drawCourts(['a', 'a', 'b', 'c'], 2), 'duplicate team refused')
const firstCourts = new Set()
for (let i = 0; i < 200; i++) {
  firstCourts.add(lo.drawCourts(teams(8), 4).draw.find(d => d.team1_id === 't1' || d.team2_id === 't1').court)
}
check(firstCourts.size === 4, 'draw is random (team 1 lands on every court)')

const asMatches = (rows, phase) =>
  rows.map((r, i) => ({
    id: phase + i,
    phase,
    team1_id: r.team1_id,
    team2_id: r.team2_id,
    winner_id: r.winner_id ?? null,
    match_order: r.court,
  }))
const d8 = lo.drawCourts(teams(8), 4).draw
check(lo.drawIsCurrent(asMatches(d8, 'draw'), teams(8)), 'fresh draw is current')
check(!lo.drawIsCurrent(asMatches(d8, 'draw'), teams(6)), 'draw is stale after teams change')
check(!lo.drawIsCurrent(asMatches(d8, 'draw'), [...teams(7), 'x']), 'draw is stale after a team swap')

// Final fixture validation
const fx = [
  { court: 1, team1_id: 't1', team2_id: 't2', winner_id: 't2' },
  { court: 2, team1_id: 't3', team2_id: 't4', winner_id: 't3' },
  { court: 3, team1_id: 't5', team2_id: 't6', winner_id: 't6' },
  { court: 4, team1_id: 't7', team2_id: 't8', winner_id: 't7' },
]
const valid = f => lo.validateFinalFixture(f, teams(8), 4)
check(valid(fx) === null, 'valid fixture accepted')
check(valid(fx.map(f => ({ ...f, winner_id: null }))) === null, 'fixture without winners accepted')
check(valid(fx.slice(0, 3)) !== null, 'missing court rejected')
check(valid([fx[0], fx[1], fx[2], { ...fx[3], team2_id: 't1' }]) !== null, 'team twice rejected')
check(valid([fx[0], fx[1], fx[2], { ...fx[3], court: 3 }]) !== null, 'court twice rejected')
check(valid([fx[0], fx[1], fx[2], { ...fx[3], team2_id: 'zz' }]) !== null, 'unknown team rejected')
check(valid([{ ...fx[0], winner_id: 't5' }, fx[1], fx[2], fx[3]]) !== null, 'winner from another court rejected')
check(valid([{ ...fx[0], team2_id: '' }, fx[1], fx[2], fx[3]]) !== null, 'empty slot rejected')

// Standings: placement only
const table4 = lo.defaultPointsTable(4)
const st = lo.finalStandings(asMatches(fx, 'final'), table4)
check(eq(st.map(s => s.team_id), ['t2', 't1', 't3', 't4', 't6', 't5', 't7', 't8']), 'ranking = court placement')
check(eq(st.map(s => s.rank), [1, 2, 3, 4, 5, 6, 7, 8]), 'ranks 1..8')
check(eq(st.map(s => s.points), [80, 50, 30, 10, 10, 0, -10, -25]), 'points by court')
const noWinner = fx.map((f, i) => (i === 2 ? { ...f, winner_id: null } : f))
check(lo.finalStandings(asMatches(noWinner, 'final'), table4) === null, 'no standings until every court has a winner')
check(lo.finalStandings(asMatches(fx, 'final'), lo.defaultPointsTable(3)) === null, 'table / court count mismatch gives no standings')
check(lo.finalStandings(asMatches(fx, 'draw'), table4) === null, 'draw rows are never ranked')
check(lo.sameStandings(st, lo.finalStandings(asMatches(fx, 'final'), table4)), 'same standings compare equal')
const flipped = lo.finalStandings(asMatches(fx.map((f, i) => (i === 0 ? { ...f, winner_id: 't1' } : f)), 'final'), table4)
check(!lo.sameStandings(st, flipped) && flipped[0].team_id === 't1', 'edited winner changes the standings')
check(!lo.sameStandings(st, null), 'null never equal')
check(lo.ordinal(1) === '1st' && lo.ordinal(2) === '2nd' && lo.ordinal(3) === '3rd' && lo.ordinal(11) === '11th', 'ordinals')

console.log(checks - failures + '/' + checks + ' checks passed')
process.exit(failures ? 1 : 0)
