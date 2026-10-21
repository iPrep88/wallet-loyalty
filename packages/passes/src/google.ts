/**
 * Google Wallet — not implemented yet, on purpose.
 *
 * Needs a Google Pay & Wallet Console issuer account and a service-account key.
 *
 * Worth knowing before Phase 2 is scheduled: a NEW issuer account starts in
 * demo mode, where a pass can only be saved by Google accounts you have
 * explicitly allowlisted. Going live requires a publishing review. That is a
 * wait measured in days, so request it early.
 *
 * Also note Google's hero image is a wide 3:1 banner (GOOGLE_HERO), not Apple's
 * short strip — the renderer already takes explicit dimensions for this reason.
 */

export interface GoogleConfig {
  issuerId: string
  serviceAccountJson: string
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
  return googleConfig() !== null
}

export function googleConfig(): GoogleConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  if (!issuerId || !encoded) return null
  return {
    issuerId,
    serviceAccountJson: Buffer.from(encoded, 'base64').toString('utf8'),
  }
}

/** TODO(google): create or update the LoyaltyClass for a program. */
export async function upsertLoyaltyClass(_args: unknown): Promise<string> {
  throw new GoogleNotConfiguredError()
}

/** TODO(google): create the LoyaltyObject and return a signed save JWT. */
export async function createSaveLink(_args: unknown): Promise<string> {
  throw new GoogleNotConfiguredError()
}

/** TODO(google): PATCH loyaltyPoints + heroImage after a stamp. */
export async function patchLoyaltyObject(_args: unknown): Promise<void> {
  throw new GoogleNotConfiguredError()
}
