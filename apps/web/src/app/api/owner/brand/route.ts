import { one, query } from '@wl/db'
import { ownerContext } from '@/lib/owner-data'
import { lookupBrand } from '@/lib/brand-lookup'
import { processUpload } from '@/lib/images'
import { body, err, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'
/** Reading someone else's site takes as long as it takes. */
export const maxDuration = 30

/**
 * "Paste your website and we will build your card."
 *
 * Fetches the owner's own site, finds their logo and colours, and returns
 * three or four finished cards to choose between. Everything it fetches goes
 * through safeFetch, which refuses private addresses — this is the one place
 * a stranger picks a URL our server then requests.
 */
export async function POST(req: Request) {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')

  const input = await body<{ url: string }>(req)
  if (!input?.url?.trim()) return err('bad_request', 'Enter your website address.')

  // Looking up a site costs real time and bandwidth on someone else's server
  // as well as ours, so it is not something to allow on a loop.
  const recent = await one<{ n: string }>(
    `select count(*)::text as n from assets
      where company_id = $1 and created_at > now() - interval '5 minutes'`,
    [ctx.company.id],
  )
  if (Number(recent?.n ?? 0) > 20) {
    return err('cooldown', 'That is a lot of lookups. Give it a minute.')
  }

  const found = await lookupBrand(input.url)
  if (!found.ok) return err('bad_request', found.message)
  const { name, logo, photo, options, siteUrl, foundBrand } = found.data

  if (options.length === 0) {
    return err('bad_request', 'We could not read anything useful from that site.')
  }

  const logoUrl = logo ? await store(ctx.company.id, 'logo', logo) : null
  const photoUrl = photo ? await store(ctx.company.id, 'photo', photo) : null

  return ok({
    site_url: siteUrl,
    name,
    found_brand: foundBrand,
    logo_url: logoUrl,
    photo_url: photoUrl,
    options: options
      // A photo option is only honest if we actually got a photo.
      .filter((o) => o.id !== 'photo' || photoUrl)
      .map((o) => ({
        id: o.id, name: o.name, blurb: o.blurb, style: o.style,
        bg_color: o.palette.bg, fg_color: o.palette.fg, label_color: o.palette.label,
      })),
  })
}

/** Normalises and stores one image, returning the URL it is served at. */
async function store(
  companyId: string,
  kind: 'logo' | 'photo',
  bytes: Buffer,
): Promise<string | null> {
  const processed = await processUpload(bytes, kind)
  // An image we cannot read is a missing option, not a failed lookup.
  if (!processed.ok) return null

  const { bytes: data, mime, width, height } = processed.image
  const asset = await one<{ id: string }>(
    `insert into assets (company_id, kind, mime, bytes, width, height)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [companyId, kind, mime, data, width, height],
  )
  return asset ? `/api/asset/${asset.id}` : null
}

/** Applies the option the owner chose. */
export async function PUT(req: Request) {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')

  const input = await body<{
    bg_color: string; fg_color: string; label_color: string
    style: 'minimal' | 'photo'
    logo_url?: string | null
    photo_url?: string | null
  }>(req)
  if (!input) return err('bad_request', 'Nothing to apply.')

  const HEX = /^#[0-9A-Fa-f]{6}$/
  for (const c of [input.bg_color, input.fg_color, input.label_color]) {
    if (!HEX.test(c)) return err('bad_request', 'That card could not be applied.')
  }
  if (input.style !== 'minimal' && input.style !== 'photo') {
    return err('bad_request', 'Unknown card style.')
  }

  const ASSET = /^\/api\/asset\/[0-9a-f-]{36}$/i
  const logoUrl = input.logo_url && ASSET.test(input.logo_url) ? input.logo_url : null
  const photoUrl = input.photo_url && ASSET.test(input.photo_url) ? input.photo_url : null

  await query(
    `update programs
        set bg_color = $2, fg_color = $3, label_color = $4, card_style = $5,
            colors_chosen = true,
            logo_url = coalesce($6, logo_url),
            photo_url = coalesce($7, photo_url),
            design_version = design_version + 1
      where id = $1`,
    [ctx.program.id, input.bg_color.toUpperCase(), input.fg_color.toUpperCase(),
     input.label_color.toUpperCase(), input.style, logoUrl, photoUrl],
  )

  const fresh = await one(`select * from programs where id = $1`, [ctx.program.id])
  return ok({ program: fresh })
}
