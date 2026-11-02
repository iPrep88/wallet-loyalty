#!/usr/bin/env node
/**
 * Are we out of demo mode?
 *
 * The Pay & Wallet console does not say. It shows classes as "Active" whether
 * or not the issuer can hand a card to the public, so the only honest answer
 * comes from the API: a class carries a reviewStatus, we create it as
 * UNDER_REVIEW, and Google moves it to APPROVED when publishing access is
 * granted.
 *
 * This matters more than it sounds. In demo mode a pass can only be saved by
 * a Google account on the console's allowlist — so everything looks perfect on
 * Ben's own phone and fails silently for the first real customer in a shop.
 * Guessing is how you find that out in front of a paying owner.
 *
 * Run it ON THE SERVER, where the service-account key lives:
 *   node deploy/wallet-status.mjs
 */
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

// The app reads its environment from pm2; a plain `node` run does not, so the
// same .env the deploy script sources is read here too.
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
if (!issuerId || !encoded) {
  console.error('GOOGLE_WALLET_ISSUER_ID or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not set.')
  process.exit(1)
}
const key = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))

const b64 = (s) => Buffer.from(s).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const claims = b64(JSON.stringify({
  iss: key.client_email,
  scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now, exp: now + 3600,
}))
const header = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
const signer = createSign('RSA-SHA256')
signer.update(`${header}.${claims}`)
const assertion = `${header}.${claims}.${b64(signer.sign(key.private_key))}`

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion,
  }),
})
const { access_token, error_description } = await tokenRes.json()
if (!access_token) {
  console.error(`Google refused an access token: ${error_description ?? tokenRes.status}`)
  process.exit(1)
}

const res = await fetch(
  `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass?issuerId=${issuerId}`,
  { headers: { Authorization: `Bearer ${access_token}` } },
)
const data = await res.json()
if (!res.ok) {
  console.error(`Listing classes failed (${res.status}):`, JSON.stringify(data, null, 2))
  process.exit(1)
}

const classes = data.resources ?? []
if (classes.length === 0) {
  console.log('No loyalty classes exist yet — create a shop first.')
  process.exit(0)
}

console.log(`Issuer ${issuerId} — ${classes.length} class(es)\n`)
for (const c of classes) {
  console.log(`  ${c.issuerName ?? '(unnamed)'}`)
  console.log(`    id           ${c.id}`)
  console.log(`    reviewStatus ${c.reviewStatus}`)
}

const approved = classes.filter((c) => c.reviewStatus === 'APPROVED')
console.log()
if (approved.length === classes.length) {
  console.log('PUBLISHED. Anyone can save a card.')
} else if (approved.length > 0) {
  console.log(`PARTLY PUBLISHED — ${classes.length - approved.length} class(es) not approved.`)
  console.log('Those shops can only issue to allowlisted Google accounts.')
} else {
  console.log('STILL IN DEMO MODE. Only Google accounts on the console allowlist')
  console.log('can save a card; everyone else sees an error. Do not sell yet.')
}
