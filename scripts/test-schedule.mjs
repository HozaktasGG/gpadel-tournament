// Replicates the R1-R3 scheduling algorithm in start/route.ts
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const generateRoundMatching = (used) => {
  const playerIdx = Array.from({ length: 12 }, (_, i) => i)
  for (let attempt = 0; attempt < 1000; attempt++) {
    const order = shuffle(playerIdx)
    const pairs = []
    let ok = true
    for (let i = 0; i < 12; i += 2) {
      const a = order[i]
      const b = order[i + 1]
      if (used.has(pairKey(a, b))) { ok = false; break }
      pairs.push([a, b])
    }
    if (ok) return pairs
  }
  return null
}

let roundPairs = null
for (let bigAttempt = 0; bigAttempt < 200; bigAttempt++) {
  const used = new Set()
  const attempt = []
  let ok = true
  for (let r = 0; r < 3; r++) {
    const m = generateRoundMatching(used)
    if (!m) { ok = false; break }
    m.forEach(([a, b]) => used.add(pairKey(a, b)))
    attempt.push(m)
  }
  if (ok) { roundPairs = attempt; break }
}
if (!roundPairs) { console.log('FAILED'); process.exit(1) }

// Assign to courts
const rounds = roundPairs.map(pairs => {
  const sp = shuffle(pairs)
  return [
    { court: 1, team1: sp[0], team2: sp[1] },
    { court: 2, team1: sp[2], team2: sp[3] },
    { court: 3, team1: sp[4], team2: sp[5] },
  ]
})

// Print and check
for (let r = 0; r < 3; r++) {
  console.log(`\n=== Round ${r + 1} ===`)
  for (const m of rounds[r]) {
    console.log(`Court ${m.court}: [${m.team1[0]},${m.team1[1]}] vs [${m.team2[0]},${m.team2[1]}]`)
  }
  // Show court membership
  for (const m of rounds[r]) {
    const players = [...m.team1, ...m.team2].sort((a, b) => a - b)
    console.log(`  Court ${m.court} players: {${players.join(',')}}`)
  }
}

// Verify: are the three R1 court sets preserved in R2/R3?
const r1Courts = rounds[0].map(m => new Set([...m.team1, ...m.team2]))
for (let r = 1; r < 3; r++) {
  console.log(`\nR${r + 1} vs R1 court membership:`)
  for (const m of rounds[r]) {
    const s = new Set([...m.team1, ...m.team2])
    const overlaps = r1Courts.map(r1 => [...s].filter(p => r1.has(p)).length)
    console.log(`  Court ${m.court} players {${[...s].sort((a, b) => a - b).join(',')}} → overlap with R1 courts: ${overlaps.join(',')}`)
  }
}

// Partner uniqueness check
const allPairs = new Set()
let dupes = 0
for (const round of rounds) {
  for (const m of round) {
    for (const pair of [m.team1, m.team2]) {
      const k = pairKey(pair[0], pair[1])
      if (allPairs.has(k)) dupes++
      allPairs.add(k)
    }
  }
}
console.log(`\nUnique partnerships: ${allPairs.size} (expected 18), duplicates: ${dupes}`)
