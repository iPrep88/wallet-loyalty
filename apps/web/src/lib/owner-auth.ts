import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { one, query, tx, type Company, type User } from '@wl/db'

/**
 * Shop-owner sign-in. Ours, not rented.
 *
 * Deliberately plain: a bcrypt hash in our own table and an HMAC-signed
 * cookie, the same pattern already used for staff PINs. It owes nothing to
 * any auth provider, which means moving this system between servers is
 * copying files rather than migrating accounts out of someone's platform.
 */
export interface OwnerSession {
  userId: string
  email: string
  /** Epoch seconds. */
  exp: number
}

const COOKIE = 'wl_owner'
const TTL_SECONDS = 60 * 60 * 24 * 30 // a month; shop owners sign in rarely

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters')
  }
  return s
}

// ------------------------------------------------------------------ cookie
function encode(session: Omit<OwnerSession, 'exp'>): string {
  const payload: OwnerSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

function decode(raw: string | undefined): OwnerSession | null {
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts as [string, string]

  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OwnerSession
    return parsed.exp * 1000 < Date.now() ? null : parsed
  } catch {
    return null
  }
}

export async function currentOwner(): Promise<OwnerSession | null> {
  return decode((await cookies()).get(COOKIE)?.value)
}

export async function setOwnerCookie(session: Omit<OwnerSession, 'exp'>): Promise<void> {
  ;(await cookies()).set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  })
}

export async function clearOwnerCookie(): Promise<void> {
  ;(await cookies()).delete(COOKIE)
}

// ----------------------------------------------------------- credentials
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

/**
 * Long beats clever. Eight characters is the floor because anything stricter
 * gets written on a sticky note by the till, which is worse than a short one
 * in a password manager.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 200) return 'That password is too long.'
  return null
}

export type SignupResult =
  | { ok: true; user: User; company: Company; storeSlug: string }
  | { ok: false; field: 'email' | 'password' | 'shop'; message: string }

/**
 * Signs an owner up and gets them a working shop in one step.
 *
 * The company and its first store are created here, silently. An owner with
 * one shop should never meet the words "company" or "store" — they typed a
 * shop name, and a shop is what they get. The structure only surfaces the day
 * they add a second location.
 */
export async function signUp(args: {
  email: string
  password: string
  shopName: string
  name?: string | null
}): Promise<SignupResult> {
  const email = args.email.trim().toLowerCase()
  const shopName = args.shopName.trim()

  if (!isValidEmail(email)) {
    return { ok: false, field: 'email', message: 'That email does not look right.' }
  }
  const pwProblem = passwordProblem(args.password)
  if (pwProblem) return { ok: false, field: 'password', message: pwProblem }
  if (shopName.length < 2) {
    return { ok: false, field: 'shop', message: 'What is your shop called?' }
  }

  const taken = await one<{ id: string }>(
    `select id from users where lower(email) = $1`, [email],
  )
  if (taken) {
    return { ok: false, field: 'email', message: 'There is already an account with that email.' }
  }

  const slug = await uniqueSlug(shopName)

  const created = await tx(async (client) => {
    const { rows: users } = await client.query<User>(
      `insert into users (email, password_hash, name) values ($1, $2, $3) returning *`,
      [email, await bcrypt.hash(args.password, 10), args.name ?? null],
    )
    const user = users[0]!

    const { rows: companies } = await client.query<Company>(
      `insert into companies (owner_user_id, name, slug, trial_ends_at)
       values ($1, $2, $3, now() + interval '30 days') returning *`,
      [user.id, shopName, slug],
    )
    const company = companies[0]!

    // The card, with defaults that look fine if they change nothing at all.
    await client.query(`insert into programs (company_id) values ($1)`, [company.id])

    // Their first location, named after the shop until they say otherwise.
    await client.query(
      `insert into stores (company_id, name, slug) values ($1, $2, $3)`,
      [company.id, shopName, slug],
    )

    return { user, company }
  })

  return { ok: true, user: created.user, company: created.company, storeSlug: slug }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true; user: User } | { ok: false; message: string }> {
  const user = await one<User>(
    `select * from users where lower(email) = lower($1)`, [email.trim()],
  )

  // Same message and roughly the same work either way, so the response does
  // not quietly reveal which emails have accounts.
  const hash = user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali'
  const matches = await bcrypt.compare(password, hash)

  if (!user || !matches) {
    return { ok: false, message: 'Wrong email or password.' }
  }

  await query(`update users set last_login_at = now() where id = $1`, [user.id])
  return { ok: true, user }
}

/** URL-safe, readable, and not already taken. */
async function uniqueSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'shop'

  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`
    const clash = await one<{ x: number }>(
      `select 1 as x from companies where slug = $1
        union all select 1 from stores where slug = $1 limit 1`,
      [candidate],
    )
    if (!clash) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}
