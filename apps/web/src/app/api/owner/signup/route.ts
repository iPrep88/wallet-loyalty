import { signUp } from '@/lib/owner-auth'
import { setOwnerCookie } from '@/lib/owner-auth'
import { sendVerificationEmail } from '@/lib/emails'
import { body, err, ok } from '@/lib/http'

interface Req { email: string; password: string; shop_name: string; name?: string }

export async function POST(req: Request) {
  const input = await body<Req>(req)
  if (!input?.email || !input.password || !input.shop_name) {
    return err('bad_request', 'Email, password and shop name are required.')
  }

  const result = await signUp({
    email: input.email,
    password: input.password,
    shopName: input.shop_name,
    name: input.name ?? null,
  })
  if (!result.ok) return err('bad_request', result.message, { field: result.field })

  await setOwnerCookie({ userId: result.user.id, email: result.user.email })

  // Sent, but never waited on for correctness. Signing up has to succeed even
  // if the mail server is down — the account exists either way, and the
  // dashboard nags about an unconfirmed address until it is confirmed.
  try {
    await sendVerificationEmail(result.user)
  } catch (e) {
    console.error('[signup] could not send the verification email', e)
  }

  return ok({ company: { name: result.company.name, slug: result.company.slug },
              store_slug: result.storeSlug })
}
