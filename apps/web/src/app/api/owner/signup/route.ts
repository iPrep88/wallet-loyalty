import { signUp } from '@/lib/owner-auth'
import { setOwnerCookie } from '@/lib/owner-auth'
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
  return ok({ company: { name: result.company.name, slug: result.company.slug },
              store_slug: result.storeSlug })
}
