/**
 * Apple Wallet — not implemented yet, on purpose.
 *
 * Everything here needs a paid Apple Developer account and a Pass Type ID
 * certificate, which we do not have. The rest of the system is built so that
 * this file is the ONLY thing standing between it and real cards: members,
 * tokens, stamps, cooldown, undo, the strip image and the job queue are all
 * finished and testable without it.
 *
 * When the certificate arrives, implement the three functions below. Nothing
 * else should need to change.
 *
 * What is needed first (see spec §13):
 *   1. Apple Developer Program membership ($99/yr).
 *   2. A Pass Type ID, and its signing certificate exported as .p12.
 *   3. The Apple WWDR intermediate certificate.
 *   4. A domain with HTTPS — Apple will not talk to the web service without it.
 *
 * One thing to get right when it is built: Apple draws logo.png in a
 * RECTANGLE at the top of the pass, so a shop's wordmark shows there in full
 * and should be used AS UPLOADED — program.logo_url, not the circle tile at
 * /api/monogram. That tile exists because Google crops to a circle, and
 * logo_crop is the owner's answer to that circle. Neither applies here, and
 * using them would shrink a perfectly good wordmark into the middle of a
 * rectangle for no reason.
 *
 * And a standing reminder: the Pass Type ID certificate EXPIRES EVERY YEAR.
 * When it lapses you cannot sign new passes and every existing card stops
 * updating, silently. Put a calendar reminder at 11 months.
 */

export interface AppleConfig {
  teamId: string
  passTypeId: string
  certP12Base64: string
  certPassword: string
  wwdrBase64: string
}

export class AppleNotConfiguredError extends Error {
  constructor() {
    super(
      'Apple Wallet is not configured. Missing one or more of: APPLE_TEAM_ID, '
      + 'APPLE_PASS_TYPE_ID, APPLE_PASS_CERT_P12_BASE64, APPLE_PASS_CERT_PASSWORD, '
      + 'APPLE_WWDR_CERT_BASE64. See packages/passes/src/apple.ts.',
    )
    this.name = 'AppleNotConfiguredError'
  }
}

/** True once every Apple env var is present. Callers degrade instead of crashing. */
export function isAppleConfigured(): boolean {
  return appleConfig() !== null
}

export function appleConfig(): AppleConfig | null {
  const {
    APPLE_TEAM_ID: teamId,
    APPLE_PASS_TYPE_ID: passTypeId,
    APPLE_PASS_CERT_P12_BASE64: certP12Base64,
    APPLE_PASS_CERT_PASSWORD: certPassword,
    APPLE_WWDR_CERT_BASE64: wwdrBase64,
  } = process.env

  if (!teamId || !passTypeId || !certP12Base64 || !certPassword || !wwdrBase64) {
    return null
  }
  return { teamId, passTypeId, certP12Base64, certPassword, wwdrBase64 }
}

/** TODO(apple): build and sign a .pkpass with `passkit-generator`. */
export async function buildPkpass(_args: unknown): Promise<Buffer> {
  throw new AppleNotConfiguredError()
}

/** TODO(apple): empty APNs push over HTTP/2 with the pass certificate. */
export async function pushToDevices(_pushTokens: string[]): Promise<void> {
  throw new AppleNotConfiguredError()
}
