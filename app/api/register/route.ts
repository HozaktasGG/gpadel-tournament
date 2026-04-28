import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { first_name, last_name, email } = await req.json()

  if (!first_name || !last_name || !email) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('tournament_registrations')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 })
  }

  const { data: countData } = await supabase
    .from('tournament_registrations')
    .select('id', { count: 'exact', head: true })

  if ((countData as unknown as number) >= 12) {
    return NextResponse.json({ error: 'All spots are full.' }, { status: 409 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('tournament_registrations')
    .insert([{
      first_name,
      last_name,
      email: email.toLowerCase(),
      email_verified: false,
      admin_approved: false,
    }])
    .select('id')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
  }

  const verifyLink = `https://smashtorino.com/verify?token=${inserted.id}`
  const cancelLink = `https://smashtorino.com/cancel?token=${inserted.id}`

  await resend.emails.send({
    from: 'info@smashtorino.com',
    to: email,
    subject: 'SmashTorino - Please Verify Your Email',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
        <p style="font-size:18px;font-weight:bold;color:#111;margin:0 0 8px;">Hi ${first_name},</p>
        <p style="font-size:15px;color:#333;margin:0 0 24px;">Thank you for registering for the <strong>GPadel Tournament</strong>!</p>

        <p style="font-size:14px;color:#333;margin:0 0 20px;">Please verify your email address by clicking the button below. After verification, your registration will be reviewed and approved by the admin.</p>

        <a href="${verifyLink}"
           style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;margin-bottom:28px;">
          Verify My Email
        </a>

        <div style="background:#f9f9f9;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
          <p style="margin:0 0 10px;font-size:14px;color:#333;">📅 <strong>April 24, 2026</strong> — Friday</p>
          <p style="margin:0 0 10px;font-size:14px;color:#333;">🕐 <strong>17:00 – 18:30</strong></p>
          <p style="margin:0 0 10px;font-size:14px;color:#333;">📍 <strong>GPadel Cenisia</strong></p>
          <p style="margin:0;font-size:14px;color:#333;">💰 <strong>Entry Fee: €17 per person</strong></p>
        </div>

        <p style="font-size:13px;color:#888;margin-top:32px;">See you on the court!<br/><strong style="color:#333;">SmashTorino Padel Community</strong></p>

        <hr style="border:none;border-top:1px solid #eee;margin:28px 0;" />
        <p style="font-size:12px;color:#aaa;margin:0 0 12px;">Need to cancel? You can cancel your registration up to 24 hours before the tournament.</p>
        <a href="${cancelLink}"
           style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;padding:10px 20px;border-radius:6px;">
          Cancel Registration
        </a>
      </div>
    `,
  })

  return NextResponse.json({ success: true })
}
