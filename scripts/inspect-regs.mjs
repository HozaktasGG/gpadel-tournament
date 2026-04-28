import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('event_registrations')
  .select('*')
  .limit(10);
if (error) {
  console.error('event_registrations error:', error.message);
} else {
  console.log('event_registrations rows:', data?.length ?? 0);
  console.log(JSON.stringify(data, null, 2));
}
