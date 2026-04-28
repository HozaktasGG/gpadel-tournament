import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: 'info@smashtorino.com',
  to: 'efeozaktas542@gmail.com',
  subject: 'SmashTorino - You\'re In! ✅',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hi Efe,</h2>
      <p>Great news! Your registration has been approved!</p>
      <p>📅 April 24, 2026 - Friday</p>
      <p>🕐 17:00</p>
      <p>📍 GPadel Cenisia</p>
      <br/>
      <a href="https://maps.app.goo.gl/ErzajT1oXJnkvBeF6" style="background-color: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 8px 0;">🗺️ Get Directions</a>
      <br/><br/>
      <a href="https://smashtorino.com/ticket?token=TEST123" style="background-color: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 8px 0;">🎫 View Your Ticket</a>
      <br/><br/>
      <a href="https://smashtorino.com/participants?token=TEST123" style="background-color: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 8px 0;">👥 View Participants</a>
      <br/><br/>
      <p>See you on the court! 🎾</p>
      <p>SmashTorino Padel Community</p>
    </div>
  `
});

console.log(error ? error : 'Email sent!', data);
