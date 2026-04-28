// Backfill score_history with each player's quiz score and last tournament bonus.
// Idempotent: skips a (user_id, reason) pair if it already exists.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/backfill-score-history.mjs

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TOURNAMENT_REASON = 'GPadel Tournament April 2026'

async function alreadyHas(userId, reason) {
  const { data } = await supabase
    .from('score_history')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', reason)
    .limit(1)
    .maybeSingle()
  return !!data
}

async function main() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, skill_score, quiz_completed_at, last_score_change')

  if (error) throw error
  if (!profiles?.length) {
    console.log('No profiles found.')
    return
  }

  let quizInserts = 0
  let bonusInserts = 0
  let skipped = 0

  for (const p of profiles) {
    const score = p.skill_score
    if (score == null || score <= 0) {
      skipped++
      continue
    }

    const lastChange = p.last_score_change ?? 0
    const quizScore = lastChange ? score - lastChange : score
    const quizDate = p.quiz_completed_at

    // Quiz entry — score equals the change (the quiz score itself)
    if (quizDate) {
      const has = await alreadyHas(p.id, 'quiz')
      if (!has) {
        const { error: insErr } = await supabase.from('score_history').insert({
          user_id: p.id,
          score: quizScore,
          change: quizScore,
          reason: 'quiz',
          created_at: quizDate,
        })
        if (insErr) console.error(`quiz insert failed for ${p.id}:`, insErr.message)
        else quizInserts++
      }
    }

    // Tournament bonus entry
    if (lastChange !== 0) {
      const has = await alreadyHas(p.id, TOURNAMENT_REASON)
      if (!has) {
        const { error: insErr } = await supabase.from('score_history').insert({
          user_id: p.id,
          score,
          change: lastChange,
          reason: TOURNAMENT_REASON,
        })
        if (insErr) console.error(`bonus insert failed for ${p.id}:`, insErr.message)
        else bonusInserts++
      }
    }
  }

  console.log(`Done. quiz=${quizInserts}, bonus=${bonusInserts}, skipped=${skipped}, total profiles=${profiles.length}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
