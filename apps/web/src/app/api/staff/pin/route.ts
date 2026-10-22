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

  const store = await one<{ id: string; name: string; company_name: string }>(
    `select s.id, s.name, c.name as company_name
       from stores s join companies c on c.id = s.company_id
      where s.slug = $1 and s.active`,
    [input.slug],
  )
  if (!store) return err('not_found', 'Shop not found.')

  const result = await authenticatePin({
    storeId: store.id, deviceId: input.deviceId, pin: input.pin,
  })
  if (!result.ok) {
    return err(result.code, result.message, { retryAfterSeconds: result.retryAfterSeconds })
  }

  await setStaffCookie({
    storeId: store.id,
    staffId: result.staff.id,
    staffName: result.staff.name,
    storeName: `${store.company_name} — ${store.name}`,
  })
  return ok({
    staff: { id: result.staff.id, name: result.staff.name },
    store: `${store.company_name} — ${store.name}`,
  })
}
