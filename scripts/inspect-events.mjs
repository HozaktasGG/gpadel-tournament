import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase.from('events').select('*');
if (error) {
  console.error('error:', error.message);
  process.exit(1);
}
console.log('row count:', data?.length ?? 0);
console.log(JSON.stringify(data, null, 2));

// Also check profiles
const { data: profiles, error: pErr } = await supabase
  .from('profiles')
  .select('*')
  .eq('email', 'efeozaktas542@gmail.com')
  .limit(1);
console.log('\nEfe profile full:', pErr ? pErr.message : JSON.stringify(profiles, null, 2));

const { data: regs, error: rErr } = await supabase
  .from('event_registrations')
  .select('*')
  .limit(5);
console.log('\nevent_registrations sample:', rErr ? rErr.message : JSON.stringify(regs, null, 2));
