import { one } from '@wl/db'
import { authenticatePin } from '@/lib/staff-auth'
import { setStaffCookie } from '@/lib/session'
import { body, err, ok } from '@/lib/http'

interface Req { slug: string; deviceId: string; pin: string }

export async function POST(req: Request) {
  const input = await body<Req>(req)
  if (!input?.slug || !input.pin || !input.deviceId) {
    return err('bad_request', 'slug, deviceId and pin are required.')
  }

  const business = await one<{ id: string; name: string }>(
    `select id, name from businesses where slug = $1`, [input.slug],
  )
  if (!business) return err('not_found', 'Shop not found.')

  const result = await authenticatePin({
    businessId: business.id,
    deviceId: input.deviceId,
    pin: input.pin,
  })
  if (!result.ok) {
    return err(result.code, result.message, { retryAfterSeconds: result.retryAfterSeconds })
  }

  await setStaffCookie({
    businessId: business.id,
    staffId: result.staff.id,
    staffName: result.staff.name,
  })
  return ok({ staff: { id: result.staff.id, name: result.staff.name }, shop: business.name })
}
