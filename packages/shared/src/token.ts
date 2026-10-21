import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The QR code printed on a member's card.
 *
 *   base64url( "<serial>.<programId>.<hmac>" )
 *   hmac = HMAC_SHA256( QR_TOKEN_SECRET, "<serial>|<programId>" )
 *
 * Deliberately static: it is embedded in a signed pass that lives on the
 * customer's phone, so it cannot rotate per scan. That means a photograph of a
 * card is a lasting stamping credential — the defences against that are the
 * server-side cooldown and the fact that every event is attributed to a staff
 * member. See the "staff fraud" note in the spec review.
 */
export interface MemberToken {
  serial: string
  programId: string
}

function sign(serial: string, programId: string, secret: string): string {
  return createHmac('sha256', secret).update(`${serial}|${programId}`).digest('base64url')
}

export function createMemberToken(
  { serial, programId }: MemberToken,
  secret = requireSecret(),
): string {
  const sig = sign(serial, programId, secret)
  return Buffer.from(`${serial}.${programId}.${sig}`, 'utf8').toString('base64url')
}

/** Returns the token's claims, or null if it is malformed or not ours. */
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
  const [serial, programId, sig] = parts as [string, string, string]
  if (!serial || !programId || !sig) return null

  const expected = sign(serial, programId, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return { serial, programId }
}

function requireSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('QR_TOKEN_SECRET must be set and at least 32 characters')
  }
  return secret
}
