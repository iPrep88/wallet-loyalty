import { one } from '@wl/db'
import { isValidEmail } from '@/lib/owner-auth'
import { sendPasswordResetEmail } from '@/lib/emails'
import { body, err, ok } from '@/lib/http'

/**
 * "I forgot my password."
 *
 * Always answers the same way, whether or not that email has an account.
 * Anything else turns this endpoint into a way to ask "does Bubble Tea Co
 * bank with you?" — and the honest version helps nobody, because a shop owner
 * who mistyped their address needs to try another address either way.
 *
 * A send that fails is swallowed for the same reason. The owner is told to
 * check their email regardless; the error goes to the server log where we can
 * see it, not into a response that distinguishes real addresses from fake.
 */
export async function POST(req: Request) {
  const input = await body<{ email: string }>(req)
  if (!input?.email || !isValidEmail(input.email)) {
    return err('bad_request', 'Enter the email you signed up with.')
  }

  const user = await one<{ id: string; email: string }>(
    `select id, email from users where lower(email) = lower($1)`, [input.email.trim()],
  )

  if (user) {
    try {
      await sendPasswordResetEmail(user)
    } catch (e) {
      console.error('[forgot] could not send the reset email', e)
    }
  }

  return ok({})
}
