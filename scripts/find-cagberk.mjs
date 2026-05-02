import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data, error } = await supabase
  .from('profiles')
  .select('id, first_name, last_name, email')
  .or('first_name.ilike.%agberk%,first_name.ilike.%ağberk%,last_name.ilike.%agberk%,last_name.ilike.%ağberk%')

if (error) {
  console.error(error)
  process.exit(1)
}

console.log(JSON.stringify(data, null, 2))
