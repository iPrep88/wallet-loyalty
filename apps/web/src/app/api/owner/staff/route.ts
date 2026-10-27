import { query, one, type Staff } from '@wl/db'
import { ownerContext } from '@/lib/owner-data'
import { generatePin, hashPin } from '@wl/shared/pin'
import { body, err, ok } from '@/lib/http'

/**
 * Staff, and the codes they use at the counter.
 *
 * Only the hash of a PIN is stored, which means a PIN can be SHOWN EXACTLY
 * ONCE — at the moment it is made. There is no "remind me" and there cannot
 * be; the alternative is keeping every shop's counter codes in readable form
 * in our database, which is a worse trade than asking an owner to issue a new
 * one. Resetting is one tap and takes a second, so the recovery path is cheap
 * enough that the safe design costs nobody anything.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')

  const staff = await query<{
    id: string; name: string; store_id: string; created_at: Date
  }>(
    `select s.id, s.name, s.store_id, s.created_at
       from staff s
       join stores st on st.id = s.store_id
      where st.company_id = $1 and s.active
      order by s.created_at`,
    [ctx.company.id],
  )
  return ok({ staff, stores: ctx.stores.map((s) => ({ id: s.id, name: s.name })) })
}

export async function POST(req: Request) {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')

  const input = await body<{ name?: string; store_id?: string }>(req)
  const name = input?.name?.trim()
  if (!name) return err('bad_request', 'Give this person a name.')
  if (name.length > 40) return err('bad_request', 'That name is too long.')

  // Default to the first location, which is the only one most shops have.
  const storeId = input?.store_id ?? ctx.stores[0]?.id
  if (!storeId || !ctx.stores.some((s) => s.id === storeId)) {
    return err('bad_request', 'That location is not yours.')
  }

  const pin = generatePin()
  const row = await one<Staff>(
    `insert into staff (store_id, name, pin_hash) values ($1, $2, $3) returning *`,
    [storeId, name, await hashPin(pin)],
  )

  // The only time this value ever leaves the server.
  return ok({ staff: { id: row!.id, name: row!.name, store_id: row!.store_id }, pin })
}

export async function PATCH(req: Request) {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')

  const input = await body<{ id?: string; action?: 'reset' | 'remove' }>(req)
  if (!input?.id) return err('bad_request', 'Which person?')

  // Scoped to this owner's own stores, so an id from somewhere else matches
  // nothing rather than reaching another shop's counter.
  const staff = await one<Staff>(
    `select s.* from staff s
       join stores st on st.id = s.store_id
      where s.id = $1 and st.company_id = $2 and s.active`,
    [input.id, ctx.company.id],
  )
  if (!staff) return err('bad_request', 'That person is not on your team.')

  if (input.action === 'remove') {
    // Deactivated, never deleted: every stamp they ever added points at this
    // row, and the history has to keep saying who did what.
    await query(`update staff set active = false where id = $1`, [staff.id])
    return ok({ removed: true })
  }

  if (input.action === 'reset') {
    const pin = generatePin()
    await query(`update staff set pin_hash = $2 where id = $1`,
      [staff.id, await hashPin(pin)])
    return ok({ staff: { id: staff.id, name: staff.name }, pin })
  }

  return err('bad_request', 'Unknown action.')
}
