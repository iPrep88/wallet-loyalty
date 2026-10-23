import { one, query, type Company, type Program, type Store } from '@wl/db'
import { currentOwner } from './owner-auth'

export interface OwnerContext {
  userId: string
  company: Company
  program: Program
  stores: Store[]
}

/**
 * The signed-in owner's shop, or null.
 *
 * Every owner-facing route goes through here, so ownership is checked in one
 * place rather than remembered at twenty call sites.
 */
export async function ownerContext(): Promise<OwnerContext | null> {
  const session = await currentOwner()
  if (!session) return null

  const row = await one<{ company: Company; program: Program }>(
    `select to_jsonb(c.*) as company, to_jsonb(p.*) as program
       from companies c join programs p on p.company_id = c.id
      where c.owner_user_id = $1
      order by c.created_at
      limit 1`,
    [session.userId],
  )
  if (!row) return null

  const stores = await query<Store>(
    `select * from stores where company_id = $1 and active order by created_at`,
    [row.company.id],
  )
  return { userId: session.userId, company: row.company, program: row.program, stores }
}

/** Fields whose change alters how the card looks, and so must bust its cache. */
const VISUAL_FIELDS = [
  'stamps_required', 'reward_in_grid', 'reward_text', 'card_style', 'stamp_icon',
  'stamp_icon_url',
  'logo_url', 'photo_url', 'bg_color', 'fg_color', 'label_color',
] as const

export function changesTheCard(
  before: Program,
  patch: Partial<Record<keyof Program, unknown>>,
): boolean {
  return VISUAL_FIELDS.some(
    (f) => patch[f] !== undefined && patch[f] !== before[f],
  )
}
