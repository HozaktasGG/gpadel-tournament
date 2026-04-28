import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. Etkinliği bul
const { data: event } = await supabase
  .from('events')
  .select('id')
  .eq('date', '2026-04-24')
  .single();

console.log('Event ID:', event.id);

// 2. tournament_registrations'dan onaylı tüm kayıtları al
const { data: registrations } = await supabase
  .from('tournament_registrations')
  .select('*')
  .eq('admin_approved', true);

console.log(`Found ${registrations.length} registrations`);

for (const reg of registrations) {
  console.log(`\nProcessing: ${reg.first_name} ${reg.last_name} (${reg.email})`);

  // 3. Kullanıcı var mı kontrol et
  const { data: { users } } = await supabase.auth.admin.listUsers();
  let user = users.find(u => u.email === reg.email);

  if (!user) {
    // 4. Kullanıcı yok, oluştur (email confirmed, random password)
    const randomPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: reg.email,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        first_name: reg.first_name,
        last_name: reg.last_name
      }
    });

    if (error) {
      console.log(`  ❌ Error creating user: ${error.message}`);
      continue;
    }

    user = newUser.user;
    console.log(`  ✅ Created user: ${user.id}`);

    // 5. Profile'a quiz verilerini taşı (varsa)
    if (reg.skill_score || reg.quiz_completed_at) {
      await supabase.from('profiles').update({
        skill_score: reg.skill_score,
        skill_level: reg.skill_level,
        quiz_completed_at: reg.quiz_completed_at,
        quiz_answers: reg.quiz_answers,
        last_score_change: reg.last_score_change || 0
      }).eq('id', user.id);
      console.log(`  ✅ Synced quiz data`);
    }
  } else {
    console.log(`  ℹ️  User already exists: ${user.id}`);
  }

  // 6. Event registration ekle
  const { error: regError } = await supabase
    .from('event_registrations')
    .upsert({
      event_id: event.id,
      user_id: user.id,
      status: 'approved'
    }, { onConflict: 'event_id,user_id' });

  if (regError) {
    console.log(`  ❌ Error registering: ${regError.message}`);
  } else {
    console.log(`  ✅ Registered for event`);
  }
}

console.log('\n✅ Done!');
