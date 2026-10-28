import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Transactional email.
 *
 * A port of the module iPrep has been sending on for a year, which is the
 * reason there is no third-party email provider here. The mailbox is already
 * paid for; a provider would be a second vendor, a second bill and three more
 * DNS records to send a few password resets a week.
 *
 * Two sending paths, both keyed on SMTP_HOST:
 *
 *   AUTHENTICATED (host + user + pass) — a mailbox logs in. Titan, which is
 *     what GoDaddy's Professional Email runs on, is smtp.titan.email:587.
 *
 *   AUTH-LESS RELAY (host only) — relay-hosting.secureserver.net:25 authorises
 *     by source IP and accepts no credentials at all. Only works from the
 *     GoDaddy box. Passing an empty auth object would make nodemailer attempt
 *     AUTH and fail, so it is omitted entirely rather than left blank.
 *
 * GRACEFUL DEGRADE: with no SMTP_HOST the module still loads and sendMail
 * LOGS what it would have sent. That keeps dev and CI booting without
 * credentials, and lets the whole reset flow be exercised locally — the link
 * comes out in the server log. It is never a substitute for real delivery,
 * which is what SMTP_REQUIRED guards against below.
 */

const host = process.env.SMTP_HOST ?? ''
const port = Number(process.env.SMTP_PORT) || 587
const user = process.env.SMTP_USER ?? ''
const pass = process.env.SMTP_PASS ?? ''
const from = process.env.MAIL_FROM || user || 'Repio <no-reply@tryrepio.com>'

const configured = Boolean(host)
const useAuth = Boolean(user && pass)

/**
 * Production opts into a loud failure. Without this, a typo in SMTP_HOST
 * degrades silently and every reset link a shop owner asks for disappears
 * into the server log — they sit waiting for an email that was never sent,
 * and nothing anywhere reports an error.
 */
if (!configured && process.env.SMTP_REQUIRED === '1') {
  throw new Error(
    'SMTP_REQUIRED=1 but SMTP_HOST is not set. Refusing to start — password '
    + 'reset and verification emails would silently not send.',
  )
}

let cached: Transporter | null = null
function transport(): Transporter {
  if (cached) return cached
  cached = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 and 25 start plain and upgrade via STARTTLS.
    secure: port === 465,
    ...(useAuth ? { auth: { user, pass } } : {}),
  })
  return cached
}

export function isMailConfigured(): boolean {
  return configured
}

export interface Mail {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendMail(mail: Mail): Promise<{ delivered: boolean }> {
  if (!configured) {
    console.warn(
      `[mail:degraded] would send to=${mail.to} subject=${JSON.stringify(mail.subject)}\n`
      + `--- text ---\n${mail.text}\n------------`,
    )
    return { delivered: false }
  }
  await transport().sendMail({ from, ...mail })
  return { delivered: true }
}

/**
 * The origin links in emails are built from.
 *
 * An email is read hours later on a different device, so a relative path is
 * useless and a guess is worse — a reset link pointing at localhost is a
 * support call. Required in production for exactly that reason.
 */
export function appOrigin(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (url) return url.replace(/\/$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL must be set — email links need an absolute URL.')
  }
  return 'http://localhost:3002'
}
