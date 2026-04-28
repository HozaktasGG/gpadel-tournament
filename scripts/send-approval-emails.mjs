import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

const { data: participants, error } = await supabase
  .from('tournament_registrations')
  .select('id, first_name, email')
  .eq('email_verified', true)
  .eq('admin_approved', true)
  .order('created_at', { ascending: true })

if (error) {
  console.error('Fetch error:', error)
  process.exit(1)
}

console.log(`Found ${participants.length} approved participants.`)

for (const p of participants) {
  const participantsLink = `https://smashtorino.com/participants?token=${p.id}`

  const { error: emailError } = await resend.emails.send({
    from: 'info@smashtorino.com',
    to: p.email,
    subject: "SmashTorino - You're In! ✅",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
        <p style="font-size:18px;font-weight:bold;color:#111;margin:0 0 8px;">Hi ${p.first_name},</p>
        <p style="font-size:15px;color:#333;margin:0 0 24px;">Great news! Your registration has been approved!</p>

        <div style="background:#f9f9f9;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
          <p style="margin:0 0 10px;font-size:14px;color:#333;">📅 <strong>April 24, 2026</strong> — Friday</p>
          <p style="margin:0 0 10px;font-size:14px;color:#333;">🕐 <strong>17:00</strong></p>
          <p style="margin:0 0 10px;font-size:14px;color:#333;">📍 <strong>GPadel Cenisia</strong></p>
        </div>

        <a href="https://maps.app.goo.gl/ErzajT1oXJnkvBeF6"
           style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;margin-bottom:12px;">
          🗺️ Get Directions
        </a>

        <br/>

        <a href="${participantsLink}"
           style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;margin-bottom:28px;">
          👥 View All Participants
        </a>

        <p style="font-size:13px;color:#888;margin-top:32px;">See you on the court!<br/><strong style="color:#333;">SmashTorino Padel Community</strong></p>
      </div>
    `,
  })

  if (emailError) {
    console.error(`❌ Failed: ${p.first_name} (${p.email})`, emailError)
  } else {
    console.log(`✅ Sent: ${p.first_name} (${p.email})`)
  }
}

console.log('Done.')
