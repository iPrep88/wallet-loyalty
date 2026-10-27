import { createSign } from 'node:crypto'
import { stripPath } from '@wl/shared/strip-url'
import { BARCODE_CAPTION, cardState, headerValue } from '@wl/shared/card'
import { dealQualifier } from '@wl/shared/rewards'

/**
 * Google Wallet.
 *
 * Two objects and one link. A LoyaltyClass is the shop — its name, its
 * colours, its logo — and there is one per program. A LoyaltyObject is one
 * customer's card, and there is one per member. The "Add to Google Wallet"
 * button is a link carrying a JWT we sign; Google reads it, finds the object
 * we already made, and saves it.
 *
 * Hand-rolled against the REST API rather than pulled in through googleapis,
 * which is a very large dependency for three calls and an access token. The
 * whole auth dance below is sixty lines of node:crypto.
 *
 * Worth knowing: a NEW issuer account starts in demo mode, where a pass can
 * only be saved by Google accounts explicitly allowlisted in the Wallet
 * console. Going live needs a publishing review, which is a human and takes
 * days — so the issuer account wants requesting early.
 */

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'

export interface GoogleConfig {
  issuerId: string
  clientEmail: string
  privateKey: string
}

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super(
      'Google Wallet is not configured. Missing GOOGLE_WALLET_ISSUER_ID or '
      + 'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64. See packages/passes/src/google.ts.',
    )
    this.name = 'GoogleNotConfiguredError'
  }
}

export function isGoogleConfigured(): boolean {
  try {
    return googleConfig() !== null
  } catch {
    // Configured but malformed. isGoogleConfigured answers "should we offer
    // the button", and the answer there is no — the real error surfaces when
    // something actually tries to use it.
    return false
  }
}

export function googleConfig(): GoogleConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  if (!issuerId || !encoded) return null

  let parsed: { client_email?: string; private_key?: string }
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as typeof parsed
  } catch {
    // A truncated or double-encoded key is otherwise a baffling 401 from
    // Google an hour later. Say which setting is wrong, here, now.
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64-encoded JSON. '
      + 'Re-run: base64 -i service-account.json | tr -d "\\n"',
    )
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      'That service account JSON has no client_email/private_key. Download the '
      + 'key again from Google Cloud → Service Accounts → Keys → Add key → JSON.',
    )
  }
  return { issuerId, clientEmail: parsed.client_email, privateKey: parsed.private_key }
}

function mustConfig(): GoogleConfig {
  const c = googleConfig()
  if (!c) throw new GoogleNotConfiguredError()
  return c
}

/* ------------------------------------------------------------------ auth */

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** An RS256 JWT, signed with the service account's private key. */
function signJwt(claims: Record<string, unknown>, privateKey: string): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(claims))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${body}`)
  return `${header}.${body}.${base64url(signer.sign(privateKey))}`
}

// Google's tokens last an hour. Fetching one per stamp would add a round trip
// to every scan for no reason, so it is held until just before it expires.
let cached: { token: string; expiresAt: number } | null = null

async function accessToken(c: GoogleConfig): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token

  const now = Math.floor(Date.now() / 1000)
  const assertion = signJwt({
    iss: c.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }, c.privateKey)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const data = await res.json() as {
    access_token?: string; expires_in?: number; error_description?: string
  }
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Google would not issue an access token (${res.status}): `
      + (data.error_description ?? 'no detail given')
      + '. Check the service account has been invited as a Developer in the '
      + 'Google Pay & Wallet console.',
    )
  }
  // A minute of headroom, so a token never expires mid-request.
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
  }
  return cached.token
}

async function api(
  c: GoogleConfig,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${WALLET_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken(c)}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) as Record<string, unknown> : {} } catch { /* not JSON */ }
  return { status: res.status, data }
}

function failed(what: string, status: number, data: Record<string, unknown>): Error {
  const err = (data.error ?? {}) as { message?: string }
  return new Error(`Google Wallet: ${what} failed (${status}): ${err.message ?? 'no detail'}`)
}

/* ----------------------------------------------------------------- types */

export interface ProgramForPass {
  id: string
  design_version: number
  stamps_required: number
  reward_in_grid: boolean
  reward_text: string
  logo_url: string | null
  bg_color: string
}

export interface MemberForPass {
  serial: string
  stamps: number
}

/** Google IDs are `<issuerId>.<ours>`, and ours may only contain letters,
 *  digits, '.', '_' and '-'. UUIDs qualify as they stand. */
const classId = (c: GoogleConfig, programId: string) => `${c.issuerId}.${programId}`
const objectId = (c: GoogleConfig, serial: string) => `${c.issuerId}.${serial}`

/** Google fetches our images from the public internet, so every URL it is
 *  given has to be absolute. */
function absolute(origin: string, path: string): string {
  return path.startsWith('http') ? path : `${origin.replace(/\/$/, '')}${path}`
}

function heroFor(program: ProgramForPass, stamps: number, origin: string) {
  const count = Math.min(stamps, program.stamps_required)
  return {
    sourceUri: {
      uri: absolute(origin, stripPath({
        programId: program.id,
        designVersion: program.design_version,
        state: cardState(stamps, program.stamps_required),
        count,
        size: 'hero',
      })),
    },
    contentDescription: {
      defaultValue: {
        language: 'en-CA',
        value: `${count} of ${program.stamps_required} stamps collected`,
      },
    },
  }
}

/* ---------------------------------------------------------------- class */

/**
 * The shop, as Google knows it. Created on first use and updated after that:
 * this API has no upsert, so it is a create that falls back to a patch once
 * the class is already there.
 */
export async function upsertLoyaltyClass(args: {
  program: ProgramForPass
  shopName: string
  origin: string
}): Promise<string> {
  const c = mustConfig()
  const id = classId(c, args.program.id)

  const body: Record<string, unknown> = {
    id,
    issuerName: args.shopName,
    programName: args.shopName,
    // A class has to be submitted for review before it can be issued to
    // anyone outside the allowlist. Demo mode ignores this, but going live
    // requires at least one class in this state.
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: args.program.bg_color,
    ...(args.program.logo_url
      ? {
          programLogo: {
            sourceUri: { uri: absolute(args.origin, args.program.logo_url) },
            contentDescription: {
              defaultValue: { language: 'en-CA', value: `${args.shopName} logo` },
            },
          },
        }
      : {}),
  }

  const created = await api(c, 'POST', '/loyaltyClass', body)
  if (created.status === 200 || created.status === 201) return id

  // 409 is the normal path after the first time: this shop already exists.
  if (created.status === 409) {
    const patched = await api(c, 'PATCH', `/loyaltyClass/${encodeURIComponent(id)}`, body)
    if (patched.status !== 200) throw failed('updating the shop', patched.status, patched.data)
    return id
  }
  throw failed('creating the shop', created.status, created.data)
}

/* --------------------------------------------------------------- object */

/**
 * Creates the customer's card and returns the "Add to Google Wallet" link.
 *
 * The object is created over REST FIRST, and the link then merely points at
 * it. Google does allow the whole object to travel inside the link instead,
 * which is one call fewer — but then the card does not exist until the
 * customer taps save, and every later attempt to add a stamp would 404
 * against an object that was never made. Creating it up front means a stamp
 * always has something to update.
 */
export async function createSaveLink(args: {
  program: ProgramForPass
  member: MemberForPass
  shopName: string
  storeName: string
  cardToken: string
  origin: string
}): Promise<string> {
  const c = mustConfig()
  await upsertLoyaltyClass({
    program: args.program, shopName: args.shopName, origin: args.origin,
  })

  const { program, member } = args
  const body: Record<string, unknown> = {
    id: objectId(c, member.serial),
    classId: classId(c, program.id),
    state: 'ACTIVE',
    accountName: args.shopName,
    accountId: member.serial,
    loyaltyPoints: {
      label: 'Stamps',
      balance: { string: headerValue(member.stamps, program.stamps_required) },
    },
    barcode: {
      type: 'QR_CODE',
      value: args.cardToken,
      alternateText: BARCODE_CAPTION,
    },
    heroImage: heroFor(program, member.stamps, args.origin),
    hexBackgroundColor: program.bg_color,
    textModulesData: [
      {
        id: 'reward',
        header: 'Reward',
        body: `${program.reward_text} — `
          + dealQualifier(program.stamps_required, program.reward_in_grid),
      },
      { id: 'store', header: 'Location', body: args.storeName },
    ],
  }

  const created = await api(c, 'POST', '/loyaltyObject', body)
  // 409 means they joined before and are re-adding the card. Refresh it
  // rather than leave it at whatever it last held.
  if (created.status === 409) {
    const patched = await api(
      c, 'PATCH', `/loyaltyObject/${encodeURIComponent(String(body.id))}`, body)
    if (patched.status !== 200) throw failed('updating the card', patched.status, patched.data)
  } else if (created.status !== 200 && created.status !== 201) {
    throw failed('creating the card', created.status, created.data)
  }

  const now = Math.floor(Date.now() / 1000)
  const jwt = signJwt({
    iss: c.clientEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: now,
    payload: { loyaltyObjects: [{ id: body.id }] },
  }, c.privateKey)

  return `https://pay.google.com/gp/v/save/${jwt}`
}

/* ---------------------------------------------------------------- patch */

/**
 * After a stamp. Only the two things that changed are sent — the count and
 * the artwork — because a PATCH here replaces exactly the fields it is given,
 * and posting the whole object back would overwrite anything Google or the
 * customer has set on it since.
 */
export async function patchLoyaltyObject(args: {
  program: ProgramForPass
  member: MemberForPass
  origin: string
}): Promise<void> {
  const c = mustConfig()
  const { program, member } = args

  const res = await api(
    c, 'PATCH', `/loyaltyObject/${encodeURIComponent(objectId(c, member.serial))}`,
    {
      loyaltyPoints: {
        label: 'Stamps',
        balance: { string: headerValue(member.stamps, program.stamps_required) },
      },
      heroImage: heroFor(program, member.stamps, args.origin),
    },
  )

  // A customer who joined on an iPhone, or who never tapped save, has no
  // object on Google's side. There is simply no card to update — not a
  // failure, and not worth retrying for ever.
  if (res.status === 404) return
  if (res.status !== 200) throw failed('updating the card', res.status, res.data)
}
