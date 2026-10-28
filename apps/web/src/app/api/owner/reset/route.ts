import bcrypt from 'bcryptjs'
import { one, query } from '@wl/db'
import { passwordProblem, setOwnerCookie } from '@/lib/owner-auth'
import { consumeToken } from '@/lib/email-tokens'
import { body, err, ok } from '@/lib/http'

/**
 * Setting a new password from a reset link.
 *
 * The password is checked BEFORE the token is spent. Otherwise someone who
 * types a six-character password burns their only link and has to start the
 * whole thing again, from an email they are no longer looking at.
 *
 * Reaching here also proves the address works, so it counts as verifying it —
 * asking someone to confirm an inbox they just received a link in would be
 * theatre.
 */
export async function POST(req: Request) {
  const input = await body<{ token: string; password: string }>(req)
  if (!input?.token || !input.password) {
    return err('bad_request', 'That link is no longer valid. Ask for a new one.')
  }

  const pwProblem = passwordProblem(input.password)
  if (pwProblem) return err('bad_request', pwProblem, { field: 'password' })

  const consumed = await consumeToken(input.token, 'reset')
  if (!consumed.ok) return err('bad_token', consumed.message)

  const user = await one<{ id: string; email: string }>(
    `update users
        set password_hash = $2,
            email_verified_at = coalesce(email_verified_at, now())
      where id = $1
      returning id, email`,
    [consumed.userId, await bcrypt.hash(input.password, 10)],
  )
  if (!user) return err('bad_token', 'That link is no longer valid. Ask for a new one.')

  // Any verification link still outstanding is pointless now.
  await query(
    `update email_tokens set used_at = now()
      where user_id = $1 and used_at is null`,
    [user.id],
  )

  // Signed in on the spot: they proved they hold the inbox and just chose the
  // password, so a login form here is a step that asks them to prove it twice.
  //
  // Worth knowing: sessions are signed cookies, not rows, so this does not and
  // cannot sign out a thief who already has one. Revoking those needs a
  // per-user token version in the cookie — worth doing the day Repio holds
  // anything more sensitive than a stamp count.
  await setOwnerCookie({ userId: user.id, email: user.email })
  return ok({ email: user.email })
}
