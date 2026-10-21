import { addStamps } from '@/lib/stamps'
import { currentStaff } from '@/lib/session'
import { body, err, ok } from '@/lib/http'

interface Req { token: string; quantity?: number; client_event_id: string }

export async function POST(req: Request) {
  const staff = await currentStaff()
  if (!staff) return err('bad_pin', 'Enter your PIN to start scanning.')

  const input = await body<Req>(req)
  if (!input?.token || !input.client_event_id) {
    return err('bad_request', 'token and client_event_id are required.')
  }

  const result = await addStamps({
    token: input.token,
    businessId: staff.businessId,
    staffId: staff.staffId,
    quantity: input.quantity ?? 1,
    clientEventId: input.client_event_id,
  })
  if (!result.ok) {
    return err(result.code, result.message, { retryAfterSeconds: result.retryAfterSeconds })
  }
  return ok({ member: result.data })
}
