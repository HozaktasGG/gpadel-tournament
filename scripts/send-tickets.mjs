import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const recipients = ['Kaya Dalbaz', 'Gokdeniz Abat'];

for (const name of recipients) {
  const [firstName, lastName] = name.split(' ');
  const { data } = await supabase
    .from('tournament_registrations')
    .select('*')
    .ilike('first_name', firstName)
    .ilike('last_name', lastName)
    .eq('admin_approved', true)
    .single();

  if (!data) { console.log(name + ' not found'); continue; }

  await resend.emails.send({
    from: 'info@smashtorino.com',
    to: data.email,
    subject: 'SmashTorino - Your Ticket is Ready! 🎫',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Hi ${data.first_name},</h2>
        <p>Your ticket for the GPadel Tournament is ready!</p>
        <p>📅 April 24, 2026 - Friday</p>
        <p>🕐 17:00</p>
        <p>📍 GPadel Cenisia</p>
        <br/>
        <a href="https://smashtorino.com/ticket?token=${data.id}" style="background-color: #ff6b35; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px;">🎫 View Your Ticket</a>
        <br/><br/>
        <p>Show the QR code at the entrance.</p>
        <p>See you on the court! 🎾</p>
        <p>SmashTorino Padel Community</p>
      </div>
    `
  });
  console.log('Sent to ' + data.email);
}
