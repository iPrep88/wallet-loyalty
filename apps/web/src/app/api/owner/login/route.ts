import { signIn, setOwnerCookie } from '@/lib/owner-auth'
import { body, err, ok } from '@/lib/http'

export async function POST(req: Request) {
  const input = await body<{ email: string; password: string }>(req)
  if (!input?.email || !input.password) {
    return err('bad_request', 'Email and password are required.')
  }

  const result = await signIn(input.email, input.password)
  if (!result.ok) return err('bad_pin', result.message)

  await setOwnerCookie({ userId: result.user.id, email: result.user.email })
  return ok({ email: result.user.email })
}
