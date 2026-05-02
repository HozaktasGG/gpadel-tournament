import { Resend } from 'resend'
import fs from 'fs'
import path from 'path'

const TO = 'efeozaktas542@gmail.com'
const FIRST_NAME = 'Efe'

const resend = new Resend(process.env.RESEND_API_KEY)

const logoBuffer = fs.readFileSync(path.join(process.cwd(), 'public', 'collab-logo.png'))
const logoBase64 = logoBuffer.toString('base64')

function buildHtml(firstName) {
  const safeName = firstName || 'Player'
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0f1923;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1923;padding:0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0f1923;">
            <tr>
              <td align="center" style="padding:30px 20px;background-color:#0f1923;">
                <img src="cid:collab-logo" alt="Chase The Red x SmashTorino" width="300" style="display:block;margin:0 auto;max-width:100%;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px;">
                <div style="background:#7B1A1A;border:1px solid #ff4444;border-radius:8px;padding:14px 18px;margin:0 0 24px 0;text-align:center;">
                  <p style="color:#ffcccc;font-size:14px;margin:0;line-height:1.6;">
                    ⚠️ <strong>Correction:</strong> This is a correction email — please disregard our previous email.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 8px;">
                <p style="margin:0 0 14px;color:#ffffff;font-size:16px;line-height:1.5;">Hi ${safeName},</p>
                <p style="margin:0 0 22px;color:#ffffff;font-size:15px;line-height:1.6;">
                  Thank you for registering for the <strong style="color:#ff6b35;">Chase The Red &times; SmashTorino Padel Cup</strong>! We're thrilled to have you on the court.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px;">
                <h2 style="margin:0 0 14px;color:#ffffff;font-size:18px;font-weight:700;">📅 Event Details</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a2744;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                  <tr>
                    <td style="padding:20px 22px;">
                      <p style="margin:0 0 10px;color:#ffffff;font-size:14px;line-height:1.6;">📆 <strong>Date:</strong> Sunday, May 3, 2026</p>
                      <p style="margin:0 0 10px;color:#ffffff;font-size:14px;line-height:1.6;">📍 <strong>Venue:</strong> Brangi's Padel Nizza</p>
                      <p style="margin:0 0 10px;color:#ffffff;font-size:14px;line-height:1.6;">🏠 <strong>Address:</strong> Via Giovanni Ribet, 8, 10125, Torino TO</p>
                      <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.6;">⏰ Please arrive by <strong style="color:#ff6b35;">1:30 PM (13:30)</strong> &mdash; the tournament starts shortly after and we want everyone warmed up and ready to go.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 28px 8px;">
                <a href="https://maps.app.goo.gl/tFA9VFaS9zb5vWYx5" style="display:inline-block;background-color:#ff6b35;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:8px;">
                  Get Directions →
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;">
                <h2 style="margin:0 0 14px;color:#ffffff;font-size:18px;font-weight:700;">🏆 Format</h2>
                <p style="margin:0 0 10px;color:#ffffff;font-size:14px;line-height:1.6;">16 teams &middot; 4 groups &middot; Group stage + Knockout bracket</p>
                <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.6;">Group matches are <strong>20 minutes</strong> each. Quarter-finals, semi-finals and the final are played as <strong>full sets</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(255,107,53,0.08);border-left:3px solid #ff6b35;border-radius:6px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.6;">📱 <strong style="color:#ff6b35;">Important:</strong> Please make sure your phone number is saved on your profile at <a href="https://smashtorino.com" style="color:#ff6b35;text-decoration:underline;">smashtorino.com</a> so we can reach you if needed.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 32px;">
                <p style="margin:0 0 6px;color:#ffffff;font-size:15px;line-height:1.6;">See you on the court! 🎾</p>
                <p style="margin:0;color:#ff6b35;font-size:14px;font-weight:700;">SmashTorino &amp; Chase The Red Team</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#0a1520;padding:24px;border-top:1px solid #1a2744;" align="center">
                <div style="margin-bottom:16px;">
                  <a href="https://www.instagram.com/smashtorino" style="display:inline-block;margin:0 12px;text-decoration:none;color:#aaa;font-size:13px;">📷 @smashtorino</a>
                  <a href="https://www.instagram.com/chasethered.to" style="display:inline-block;margin:0 12px;text-decoration:none;color:#aaa;font-size:13px;">📷 @chasethered.to</a>
                </div>
                <p style="color:#444;font-size:11px;margin:0;">© 2026 SmashTorino · Chase The Red</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

const { error } = await resend.emails.send({
  from: 'SmashTorino <info@smashtorino.com>',
  to: TO,
  subject: "You're registered! Chase The Red × SmashTorino Padel Cup 🎾",
  html: buildHtml(FIRST_NAME),
  attachments: [
    {
      filename: 'collab-logo.png',
      content: logoBase64,
      contentId: 'collab-logo',
    },
  ],
})

if (error) {
  console.error(`Failed: ${TO}`, error)
  process.exit(1)
}

console.log(`Sent to: ${TO}`)
