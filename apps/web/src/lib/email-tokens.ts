import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { one, query } from '@wl/db'

/**
 * Single-use links sent to an email address.
 *
 * The token in the URL is the only copy. What we keep is its SHA-256 hash, so
 * a leaked backup cannot be replayed into anyone's account — the same reason
 * passwords are not stored either. No salt and no bcrypt here on purpose: the
 * input is 32 bytes of randomness, not a human-chosen secret, so there is
 * nothing to brute-force and nothing a rainbow table can precompute.
 */

export type TokenKind = 'verify' | 'reset'

/**
 * A reset link is a key to the account, so it expires in an hour. A
 * verification link proves nothing dangerous — worst case someone confirms an
 * address they already own — and an owner may well read it the next morning.
 */
const TTL_MINUTES: Record<TokenKind, number> = {
  reset: 60,
  verify: 60 * 24 * 7,
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * Issues a token and retires that user's outstanding ones of the same kind.
 *
 * Retiring matters: someone who clicks "forgot password" three times because
 * nothing arrived should not leave three live keys to their account lying in
 * three inboxes. The newest wins and the older ones stop working.
 */
export async function issueToken(userId: string, kind: TokenKind): Promise<string> {
  await query(
    `update email_tokens set used_at = now()
      where user_id = $1 and kind = $2 and used_at is null`,
    [userId, kind],
  )

  const token = randomBytes(32).toString('base64url')
  await query(
    `insert into email_tokens (user_id, kind, token_hash, expires_at)
     values ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, kind, hash(token), TTL_MINUTES[kind]],
  )
  return token
}

export type Consumed =
  | { ok: true; userId: string }
  | { ok: false; message: string }

/**
 * Spends a token, or explains why it cannot be spent.
 *
 * Deliberately one message for every failure. "That link has expired" versus
 * "that link is not valid" tells someone holding a stolen token which of the
 * two they have, and tells the person who legitimately clicked an old link
 * nothing they can act on differently — either way the answer is to ask for a
 * new one.
 */
export async function consumeToken(token: string, kind: TokenKind): Promise<Consumed> {
  if (!token || token.length > 200) {
    return { ok: false, message: 'That link is no longer valid. Ask for a new one.' }
  }

  // The update is the check: `used_at is null` and the expiry are both in the
  // WHERE clause, so two clicks on the same link race against the database
  // rather than against each other, and exactly one of them wins.
  const row = await one<{ user_id: string }>(
    `update email_tokens set used_at = now()
      where token_hash = $1 and kind = $2 and used_at is null and expires_at > now()
      returning user_id`,
    [hash(token), kind],
  )
  if (!row) {
    return { ok: false, message: 'That link is no longer valid. Ask for a new one.' }
  }
  return { ok: true, userId: row.user_id }
}

/** Constant-time compare, for callers checking a token against a known value. */
export function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(hash(a))
  const y = Buffer.from(hash(b))
  return x.length === y.length && timingSafeEqual(x, y)
}
