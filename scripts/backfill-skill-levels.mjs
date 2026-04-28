import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getLevel(score) {
  if (score >= 1301) return 'Pro';
  if (score >= 1101) return 'Elite';
  if (score >= 901) return 'Expert';
  if (score >= 701) return 'Advanced';
  if (score >= 501) return 'Intermediate';
  if (score >= 301) return 'Lower Intermediate';
  return 'Beginner';
}

async function backfillTable(table) {
  const { data, error } = await supabase
    .from(table)
    .select('id, first_name, last_name, skill_score, skill_level')
    .not('skill_score', 'is', null);

  if (error) {
    console.error(`${table} fetch error:`, error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log(`${table}: no rows with skill_score`);
    return;
  }

  let updated = 0;
  for (const row of data) {
    const newLevel = getLevel(row.skill_score);
    if (newLevel === row.skill_level) continue;

    const { error: updErr } = await supabase
      .from(table)
      .update({ skill_level: newLevel })
      .eq('id', row.id);

    if (updErr) {
      console.error(`${table} update failed for ${row.first_name}: ${updErr.message}`);
      continue;
    }

    console.log(
      `${table}: ${row.first_name} ${row.last_name ?? ''} — ${row.skill_score} pts — ${row.skill_level} → ${newLevel}`
    );
    updated++;
  }
  console.log(`${table}: ${updated} row(s) updated.\n`);
}

await backfillTable('tournament_registrations');
await backfillTable('profiles');
console.log('Done.');
