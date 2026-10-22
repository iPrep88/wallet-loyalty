import { query, one, type Program } from '@wl/db'
import { ownerContext, changesTheCard } from '@/lib/owner-data'
import {
  isValidRewardText, parseRewardValue,
  STAMPS_REQUIRED_MIN, STAMPS_REQUIRED_MAX, CARD_STYLES, STAMP_ICONS,
} from '@wl/shared'
import { body, err, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')
  return ok({ company: ctx.company, program: ctx.program, stores: ctx.stores })
}

interface Patch {
  shop_name?: string
  store_name?: string
  address?: string
  latitude?: number | null
  longitude?: number | null

  card_style?: string
  stamp_icon?: string
  bg_color?: string
  fg_color?: string
  label_color?: string

  stamps_required?: number
  reward_text?: string
  reward_value?: string      // dollars, as typed

  back_hours?: string
  back_instagram?: string
  back_menu_url?: string
}

const HEX = /^#[0-9a-fA-F]{6}$/

export async function PUT(req: Request) {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')

  const input = await body<Patch>(req)
  if (!input) return err('bad_request', 'Nothing to save.')

  const patch: Record<string, unknown> = {}

  if (input.card_style !== undefined) {
    if (!CARD_STYLES.some((s) => s.id === input.card_style)) {
      return err('bad_request', 'Unknown card style.')
    }
    patch.card_style = input.card_style
  }
  if (input.stamp_icon !== undefined) {
    if (!STAMP_ICONS.includes(input.stamp_icon as never)) {
      return err('bad_request', 'Unknown stamp icon.')
    }
    patch.stamp_icon = input.stamp_icon
  }
  for (const key of ['bg_color', 'fg_color', 'label_color'] as const) {
    const v = input[key]
    if (v === undefined) continue
    if (!HEX.test(v)) return err('bad_request', 'Colours must look like #1A2B3C.')
    patch[key] = v.toUpperCase()
    // They touched a colour; stop picking for them from here on.
    patch.colors_chosen = true
  }
  if (input.stamps_required !== undefined) {
    const n = Math.floor(input.stamps_required)
    if (!Number.isFinite(n) || n < STAMPS_REQUIRED_MIN || n > STAMPS_REQUIRED_MAX) {
      return err('bad_request',
        `Stamps must be between ${STAMPS_REQUIRED_MIN} and ${STAMPS_REQUIRED_MAX}.`)
    }
    patch.stamps_required = n
  }
  if (input.reward_text !== undefined) {
    if (!isValidRewardText(input.reward_text)) {
      return err('bad_request', 'Keep the reward short enough to fit on the card.')
    }
    patch.reward_text = input.reward_text.trim()
  }
  if (input.reward_value !== undefined) {
    const cents = parseRewardValue(input.reward_value)
    if (cents === 'invalid') return err('bad_request', 'That reward value does not look right.')
    patch.reward_value_cents = cents
  }
  for (const key of ['back_hours', 'back_instagram', 'back_menu_url'] as const) {
    if (input[key] !== undefined) patch[key] = input[key]?.trim() || null
  }

  // An edit that changes how the card looks has to bump design_version, or
  // every member keeps the artwork cached at the old URL forever.
  if (Object.keys(patch).length > 0) {
    const bump = changesTheCard(ctx.program, patch as Partial<Program>)
    const cols = Object.keys(patch)
    const sets = cols.map((c, i) => `${c} = $${i + 2}`)
    if (bump) sets.push('design_version = design_version + 1')
    await query(
      `update programs set ${sets.join(', ')} where id = $1`,
      [ctx.program.id, ...cols.map((c) => patch[c])],
    )
  }

  // Shop and store details live on their own tables.
  if (input.shop_name?.trim()) {
    const next = input.shop_name.trim()
    const previous = ctx.company.name
    await query(`update companies set name = $2 where id = $1`, [ctx.company.id, next])

    // Signup names the first store after the shop. An owner who later renames
    // the shop means both — they have never been shown that there are two
    // names. Only rename a store still carrying the old shop name, so a
    // location someone deliberately called "Yonge St" is left alone.
    await query(
      `update stores set name = $2 where company_id = $1 and name = $3`,
      [ctx.company.id, next, previous],
    )
  }
  const first = ctx.stores[0]
  if (first) {
    const storePatch: Record<string, unknown> = {}
    if (input.store_name?.trim()) storePatch.name = input.store_name.trim()
    if (input.address !== undefined) storePatch.address = input.address?.trim() || null
    if (input.latitude !== undefined) storePatch.latitude = input.latitude
    if (input.longitude !== undefined) storePatch.longitude = input.longitude
    const cols = Object.keys(storePatch)
    if (cols.length) {
      await query(
        `update stores set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} where id = $1`,
        [first.id, ...cols.map((c) => storePatch[c])],
      )
    }
    // Keep the back of the card in step with the address the owner typed.
    if (input.address !== undefined) {
      await query(`update programs set back_address = $2 where id = $1`,
        [ctx.program.id, input.address?.trim() || null])
    }
  }

  const fresh = await one<Program>(`select * from programs where id = $1`, [ctx.program.id])
  return ok({ program: fresh })
}
