import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data, error } = await supabase
  .from('tournament_registrations')
  .select('*')
  .ilike('first_name', 'Can')
  .ilike('last_name', 'Dalbaz')

if (error) {
  console.error('Query error:', error)
  process.exit(1)
}
if (!data || data.length === 0) {
  console.log('Can Dalbaz not found')
  process.exit(1)
}
if (data.length > 1) {
  console.log('Multiple matches:', data.map(d => ({ id: d.id, email: d.email, approved: d.admin_approved })))
  process.exit(1)
}

const reg = data[0]
console.log('Found:', {
  id: reg.id,
  first_name: reg.first_name,
  last_name: reg.last_name,
  email: reg.email,
  email_verified: reg.email_verified,
  admin_approved: reg.admin_approved,
})

if (process.argv[2] !== '--send') {
  console.log('\nDry run. Pass --send to actually send the email.')
  process.exit(0)
}

const res = await resend.emails.send({
  from: 'info@smashtorino.com',
  to: reg.email,
  subject: 'SmashTorino - Your Ticket is Ready! 🎫',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hi ${reg.first_name},</h2>
      <p>Your ticket for the GPadel Tournament is ready!</p>
      <p>📅 April 24, 2026 - Friday</p>
      <p>🕐 17:00</p>
      <p>📍 GPadel Cenisia</p>
      <br/>
      <a href="https://smashtorino.com/ticket?token=${reg.id}" style="background-color: #ff6b35; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px;">🎫 View Your Ticket</a>
      <br/><br/>
      <p>Show the QR code at the entrance.</p>
      <p>See you on the court! 🎾</p>
      <p>SmashTorino Padel Community</p>
    </div>
  `,
})
console.log('Send result:', res)
