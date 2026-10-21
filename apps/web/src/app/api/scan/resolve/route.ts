import { resolve } from '@/lib/stamps'
import { currentStaff } from '@/lib/session'
import { body, err, ok } from '@/lib/http'

export async function POST(req: Request) {
  const staff = await currentStaff()
  if (!staff) return err('bad_pin', 'Enter your PIN to start scanning.')

  const input = await body<{ token: string }>(req)
  if (!input?.token) return err('bad_request', 'token is required.')

  const result = await resolve(input.token, staff.businessId)
  if (!result.ok) return err(result.code, result.message)
  return ok({ member: result.data })
}
