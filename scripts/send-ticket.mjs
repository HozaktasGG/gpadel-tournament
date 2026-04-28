import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Profil ve event'i ayrı sorgularla çek
const { data: profile } = await supabase
  .from('profiles')
  .select('id, first_name, last_name, email')
  .eq('email', 'efeozaktas542@gmail.com')
  .single();

if (!profile) {
  console.log('❌ Profil bulunamadı: efeozaktas542@gmail.com');
  process.exit(1);
}

const { data: event } = await supabase
  .from('events')
  .select('id')
  .eq('date', '2026-04-24')
  .single();

if (!event) {
  console.log('❌ 2026-04-24 tarihi için event bulunamadı');
  process.exit(1);
}

const { data: registration } = await supabase
  .from('event_registrations')
  .select('id, status')
  .eq('user_id', profile.id)
  .eq('event_id', event.id)
  .single();

if (!registration) {
  console.log('❌ Efe Özaktaş kaydı bulunamadı');
  process.exit(1);
}

const { first_name, last_name, email } = profile;
const ticketUrl = `https://smashtorino.com/ticket?token=${registration.id}`;

// QR kod URL (Google Charts API)
const qrData = JSON.stringify({
  id: registration.id,
  name: `${first_name} ${last_name}`,
  email: email,
  event: 'GPadel Tournament - April 2026',
  date: '2026-04-24',
  time: '17:00'
});
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

// Mail gönder
const { data, error } = await resend.emails.send({
  from: 'SmashTorino <info@smashtorino.com>',
  to: email,
  subject: '🎾 Your SmashTorino Tournament Ticket',
  html: `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: #1a3d2e; color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .ticket { background: linear-gradient(135deg, #1a3d2e 0%, #2d5a45 100%); color: white; padding: 30px; border-radius: 12px; margin: 20px 0; }
          .qr { text-align: center; margin: 20px 0; }
          .qr img { border: 4px solid white; border-radius: 8px; }
          .info { margin: 15px 0; }
          .label { font-size: 12px; opacity: 0.8; text-transform: uppercase; }
          .value { font-size: 18px; font-weight: bold; margin-top: 5px; }
          .button { display: inline-block; background: #ff6b35; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎾 Tournament Ticket</h1>
            <p>GPadel Tournament - April 2026</p>
          </div>
          <div class="content">
            <h2>Hi ${first_name}!</h2>
            <p>Your ticket is ready. Show this QR code at check-in:</p>

            <div class="ticket">
              <div class="qr">
                <img src="${qrUrl}" alt="QR Code" />
              </div>

              <div class="info">
                <div class="label">Name</div>
                <div class="value">${first_name} ${last_name}</div>
              </div>

              <div class="info">
                <div class="label">Date & Time</div>
                <div class="value">Friday, April 24, 2026 - 17:00</div>
              </div>

              <div class="info">
                <div class="label">Location</div>
                <div class="value">GPadel Cenisia</div>
              </div>

              <div class="info">
                <div class="label">Format</div>
                <div class="value">Americano (4 rounds)</div>
              </div>
            </div>

            <center>
              <a href="${ticketUrl}" class="button">View Full Ticket</a>
            </center>

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              See you on the court! 🎾
            </p>
          </div>

          <div class="footer">
            <p>SmashTorino - Torino's Padel Community</p>
            <p><a href="https://smashtorino.com">smashtorino.com</a></p>
          </div>
        </div>
      </body>
    </html>
  `
});

if (error) {
  console.log('❌ Mail gönderilemedi:', error);
} else {
  console.log('✅ Bilet gönderildi:', email);
  console.log('Mail ID:', data.id);
}
