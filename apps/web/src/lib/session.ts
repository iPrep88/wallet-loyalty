import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * A staff scanner session: an HMAC-signed cookie, no server-side store.
 *
 * Owner authentication is Phase 4 and will be Supabase Auth. This covers the
 * scanner only, which is all the foundation needs.
 */
export interface StaffSession {
  storeId: string
  staffId: string
  staffName: string
  storeName: string
  /** Epoch seconds. */
  exp: number
}

const COOKIE = 'wl_staff'
const TTL_SECONDS = 60 * 60 * 12 // one shift

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters')
  }
  return s
}

export function encodeSession(
  session: Omit<StaffSession, 'exp'>,
  ttlSeconds = TTL_SECONDS,
): string {
  const payload: StaffSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function decodeSession(raw: string | undefined): StaffSession | null {
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts as [string, string]

  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StaffSession
    if (parsed.exp * 1000 < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export async function currentStaff(): Promise<StaffSession | null> {
  const store = await cookies()
  return decodeSession(store.get(COOKIE)?.value)
}

export async function setStaffCookie(session: Omit<StaffSession, 'exp'>): Promise<void> {
  const store = await cookies()
  store.set(COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  })
}

export async function clearStaffCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}
