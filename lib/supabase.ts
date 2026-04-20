import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Registration = {
  id?: number
  created_at?: string
  name: string
  surname: string
  phone: string
  email: string
  partner_name: string
  partner_surname: string
  partner_phone: string
  partner_email: string
  level: 'beginner' | 'intermediate' | 'advanced'
  category: 'mixed' | 'male' | 'female'
  notes?: string
}
