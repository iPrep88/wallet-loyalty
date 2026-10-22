import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The QR code printed on a member's card.
 *
 *   base64url( "<serial>.<storeId>.<hmac>" )
 *   hmac = HMAC_SHA256( QR_TOKEN_SECRET, "<serial>|<storeId>" )
 *
 * The store travels in the token so a scanner can reject another shop's card
 * before touching the database — stamps belong to one location, so a card from
 * the Yonge St branch is not spendable at Dundas St.
 *
 * Deliberately static: it is baked into a signed pass on the customer's phone
 * and cannot rotate. A photograph of a card is therefore a lasting stamping
 * credential. The defences are the server-side cooldown and the fact that
 * every event records which staff member caused it — detection, not
 * prevention, which is the right trade at this price point.
 */
export interface MemberToken {
  serial: string
  storeId: string
}

function sign(serial: string, storeId: string, secret: string): string {
  return createHmac('sha256', secret).update(`${serial}|${storeId}`).digest('base64url')
}

export function createMemberToken(
  { serial, storeId }: MemberToken,
  secret = requireSecret(),
): string {
  const sig = sign(serial, storeId, secret)
  return Buffer.from(`${serial}.${storeId}.${sig}`, 'utf8').toString('base64url')
}

/** The token's claims, or null if it is malformed or not ours. */
export function verifyMemberToken(
  token: string,
  secret = requireSecret(),
): MemberToken | null {
  let decoded: string
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const parts = decoded.split('.')
  if (parts.length !== 3) return null
  const [serial, storeId, sig] = parts as [string, string, string]
  if (!serial || !storeId || !sig) return null

  const expected = sign(serial, storeId, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return { serial, storeId }
}

function requireSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('QR_TOKEN_SECRET must be set and at least 32 characters')
  }
  return secret
}
