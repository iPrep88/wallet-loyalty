import { one } from '@wl/db'
import { currentOwner } from '@/lib/owner-auth'
import { consumeToken } from '@/lib/email-tokens'
import { sendVerificationEmail } from '@/lib/emails'
import { body, err, ok } from '@/lib/http'

/** Confirming an address from the link in the email. */
export async function POST(req: Request) {
  const input = await body<{ token: string }>(req)
  if (!input?.token) return err('bad_token', 'That link is no longer valid.')

  const consumed = await consumeToken(input.token, 'verify')
  if (!consumed.ok) {
    // A spent token is the ordinary result of refreshing this page, or of
    // tapping the link twice. Telling someone whose address is already
    // confirmed that their link is broken sends them looking for a problem
    // that does not exist.
    const owner = await currentOwner()
    if (owner) {
      const already = await one<{ email: string }>(
        `select email from users where id = $1 and email_verified_at is not null`,
        [owner.userId],
      )
      if (already) return ok({ email: already.email })
    }
    return err('bad_token', consumed.message)
  }

  const user = await one<{ email: string }>(
    `update users set email_verified_at = coalesce(email_verified_at, now())
      where id = $1 returning email`,
    [consumed.userId],
  )
  if (!user) return err('bad_token', 'That link is no longer valid.')
  return ok({ email: user.email })
}

/**
 * "Send it again." Only for the signed-in owner, and only for their own
 * address — an endpoint that emails whoever it is told to is a way to send
 * mail from our domain to strangers.
 */
export async function PUT() {
  const owner = await currentOwner()
  if (!owner) return err('bad_pin', 'Sign in first.')

  const user = await one<{ id: string; email: string; email_verified_at: Date | null }>(
    `select id, email, email_verified_at from users where id = $1`, [owner.userId],
  )
  if (!user) return err('not_found', 'That account no longer exists.')
  if (user.email_verified_at) return ok({ already: true })

  try {
    await sendVerificationEmail(user)
  } catch (e) {
    console.error('[verify] could not send the verification email', e)
    return err('bad_request', 'We could not send that just now. Try again in a minute.')
  }
  return ok({ sent: true })
}
