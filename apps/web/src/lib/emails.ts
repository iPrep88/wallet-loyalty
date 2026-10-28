import { MARK } from '@wl/shared/mark'
import { appOrigin, sendMail } from './mail'
import { issueToken } from './email-tokens'

/**
 * The two emails Repio sends.
 *
 * Plain on purpose. A reset email that arrives looking like a newsletter —
 * images, columns, a banner — is the exact shape spam filters distrust most,
 * and it is read on a phone at the counter in about four seconds. One
 * sentence and one button.
 *
 * Every message is built as text first and HTML second, never HTML alone: a
 * mail client that shows only the plain part must still produce a working
 * link, and a message with no text part scores worse with filters.
 */

function layout(heading: string, body: string, button: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F6F7F9;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:420px" cellpadding="0" cellspacing="0">
      <tr><td style="padding-bottom:18px">
        <span style="font-size:19px;font-weight:700;color:${MARK.blue};letter-spacing:-0.02em">Repio</span>
      </td></tr>
      <tr><td style="background:#FFFFFF;border-radius:14px;padding:26px">
        <p style="margin:0 0 10px;font-size:17px;font-weight:700">${heading}</p>
        <p style="margin:0 0 20px;font-size:14.5px;line-height:1.5;color:#4B5563">${body}</p>
        <a href="${button.href}" style="display:inline-block;background:${MARK.blue};
           color:#FFFFFF;text-decoration:none;font-size:14.5px;font-weight:600;
           padding:12px 20px;border-radius:10px">${button.label}</a>
        <p style="margin:20px 0 0;font-size:12.5px;line-height:1.5;color:#6B7280">
          If the button does not work, paste this into your browser:<br>
          <span style="color:#4B5563;word-break:break-all">${button.href}</span>
        </p>
      </td></tr>
      <tr><td style="padding-top:16px;font-size:12px;color:#9CA3AF">
        Repio — digital loyalty cards. iPrep Global Foods Ltd., Toronto.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

/**
 * Sent at signup, and again whenever an owner asks.
 *
 * Does not gate anything. Locking a shop owner out of their own dashboard
 * because an email has not arrived would cause the exact problem this is
 * meant to prevent. Its job is to catch a typo on the day it is made, while
 * the owner is still sitting there, rather than months later when they need a
 * reset and discover the address was never theirs.
 */
export async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await issueToken(user.id, 'verify')
  const href = `${appOrigin()}/verify?token=${encodeURIComponent(token)}`
  return sendMail({
    to: user.email,
    subject: 'Confirm your email for Repio',
    text: `Confirm this is your email address so you can get back into your Repio `
      + `account if you ever forget your password.\n\n${href}\n\n`
      + `The link works for 7 days. If you did not sign up for Repio, ignore this.`,
    html: layout(
      'Confirm your email',
      'This makes sure you can get back into your account if you ever forget '
      + 'your password. The link works for 7 days.',
      { label: 'Confirm my email', href },
    ),
  })
}

export async function sendPasswordResetEmail(user: { id: string; email: string }) {
  const token = await issueToken(user.id, 'reset')
  const href = `${appOrigin()}/reset?token=${encodeURIComponent(token)}`
  return sendMail({
    to: user.email,
    subject: 'Reset your Repio password',
    text: `Someone asked to reset the password on your Repio account.\n\n${href}\n\n`
      + `The link works for 1 hour and can only be used once. If this was not `
      + `you, nothing has changed and you can ignore this email.`,
    html: layout(
      'Reset your password',
      'The link works for 1 hour and can only be used once. If this was not '
      + 'you, nothing has changed — you can ignore this email.',
      { label: 'Choose a new password', href },
    ),
  })
}
