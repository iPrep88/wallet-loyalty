import { joinStore } from '@/lib/join'
import { isAppleConfigured } from '@wl/passes/apple'
import { isGoogleConfigured } from '@wl/passes/google'
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
 * actually deliver today. Neither wallet is configured yet, so this returns
 * the card token instead of a pass — enough for the join page to show a real
 * preview and for the scanner loop to be exercised end to end.
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
      google_save_url: null,
      pending,
    },
  })
}
