import { undo } from '@/lib/stamps'
import { currentStaff } from '@/lib/session'
import { body, err, ok } from '@/lib/http'

export async function POST(req: Request) {
  const staff = await currentStaff()
  if (!staff) return err('bad_pin', 'Enter your PIN to start scanning.')

  const input = await body<{ event_id: string }>(req)
  if (!input?.event_id) return err('bad_request', 'event_id is required.')

  const result = await undo({
    eventId: input.event_id,
    businessId: staff.businessId,
    staffId: staff.staffId,
  })
  if (!result.ok) return err(result.code, result.message)
  return ok({ member: result.data })
}
