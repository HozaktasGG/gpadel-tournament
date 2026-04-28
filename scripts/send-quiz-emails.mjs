import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const recipients = ['Kaya Dalbaz', 'Can Dalbaz', 'Gokdeniz Abat'];

function buildHtml(firstName, quizUrl) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#1a3d2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a3d2e;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#0f2a1f;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:36px 24px 24px;background:linear-gradient(180deg,#204a38 0%,#0f2a1f 100%);">
                <img src="https://smashtorino.com/smashpadel_logo.png" alt="SmashTorino" width="80" height="80" style="border-radius:50%;display:block;margin-bottom:12px;" />
                <p style="margin:0;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.6);">SmashTorino</p>
                <h1 style="margin:12px 0 0;color:#ffffff;font-size:26px;font-weight:700;">Padel Skill Assessment 🎾</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0 0 14px;color:#ffffff;font-size:16px;line-height:1.5;">Hi ${firstName},</p>
                <p style="margin:0 0 14px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;">
                  Evaluate your padel skills and see your ranking on the leaderboard!
                </p>
                <p style="margin:0 0 22px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                  Answer 16 quick questions about your experience, technique, and tactics.
                  You'll get a score out of <strong style="color:#ff6b35;">1000</strong> and a skill level
                  (Beginner → Expert) — plus a spot on the community leaderboard.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
                  <tr>
                    <td align="center" bgcolor="#ff6b35" style="border-radius:12px;">
                      <a href="${quizUrl}" style="display:inline-block;padding:16px 36px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;">
                        Take the Quiz →
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;text-align:center;color:rgba(255,255,255,0.4);font-size:12px;">
                  Takes about 3 minutes · One attempt only
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;">
                <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 32px;">
                <p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.6;text-align:center;">
                  See you on the court!<br/>
                  <strong style="color:rgba(255,255,255,0.75);">SmashTorino Padel Community</strong>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

for (const name of recipients) {
  const [firstName, ...rest] = name.split(' ');
  const lastName = rest.join(' ');

  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('*')
    .ilike('first_name', firstName)
    .ilike('last_name', lastName)
    .eq('admin_approved', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`${name}: supabase error — ${error.message}`);
    continue;
  }

  if (!data) {
    console.log(`${name}: not found (skipped)`);
    continue;
  }

  const quizUrl = `https://smashtorino.com/quiz?token=${data.id}`;

  const result = await resend.emails.send({
    from: 'info@smashtorino.com',
    to: data.email,
    subject: 'SmashTorino - Padel Skill Assessment 🎾',
    html: buildHtml(data.first_name, quizUrl),
  });

  if (result.error) {
    console.error(`${name}: resend error — ${JSON.stringify(result.error)}`);
    continue;
  }

  console.log(`Sent to ${data.first_name} ${data.last_name} <${data.email}>`);
}
