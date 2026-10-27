import { joinStore } from '@/lib/join'
import { isAppleConfigured } from '@wl/passes/apple'
import { createSaveLink, isGoogleConfigured } from '@wl/passes/google'
import { cardState, headerValue } from '@wl/shared'
import { body, err, ok } from '@/lib/http'

interface Req {
  slug: string
  phone?: string
  first_name?: string
  platform?: 'apple' | 'google'
  sms_consent?: boolean
}

/**
 * Creates (or recovers) a member and hands back whatever the platform can
 * actually deliver today. The card token always comes back, so the join page
 * works even with no wallet configured at all; a save link is added for each
 * wallet that IS configured.
 */
export async function POST(req: Request) {
  const input = await body<Req>(req)
  if (!input?.slug) return err('bad_request', 'slug is required.')

  const result = await joinStore({
    slug: input.slug,
    phone: input.phone ?? null,
    firstName: input.first_name ?? null,
    platform: input.platform ?? null,
    smsConsent: input.sms_consent === true,
  })
  if (!result.ok) return err('bad_request', result.message)

  const { member, program, store, token, existing } = result.data
  const pending: string[] = []
  if (!isAppleConfigured()) pending.push('apple')
  if (!isGoogleConfigured()) pending.push('google')

  // Google is asked for a save link inline because the customer is standing
  // at a counter waiting for it. If Google is slow or unhappy, they still get
  // their card page and their QR — losing the wallet button is a worse day,
  // not a broken one, and the queue has no way to hand a link back to a
  // request that already finished.
  let googleSaveUrl: string | null = null
  if (isGoogleConfigured()) {
    try {
      googleSaveUrl = await createSaveLink({
        program,
        member: { serial: member.serial, stamps: member.stamps },
        shopName: store.name,
        storeName: store.name,
        cardToken: token,
        origin: process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin,
      })
    } catch (e) {
      console.error('[join] Google save link failed:', e)
    }
  }

  return ok({
    existing,
    member: {
      serial: member.serial,
      stamps: member.stamps,
      stamps_required: program.stamps_required,
      header: headerValue(member.stamps, program.stamps_required),
      state: cardState(member.stamps, program.stamps_required),
      reward_text: program.reward_text,
      store: store.name,
    },
    card_token: token,
    wallet: {
      apple_pkpass_url: isAppleConfigured() ? `/api/pass/apple/${member.serial}` : null,
      google_save_url: googleSaveUrl,
      pending,
    },
  })
}
