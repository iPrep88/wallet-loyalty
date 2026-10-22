import sharp from 'sharp'
import { one, query } from '@wl/db'
import { ownerContext } from '@/lib/owner-data'
import { ensureReadable, paletteFromLogo } from '@wl/passes/colors'
import { err, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Takes a shop's logo, stores it, and reads a palette out of it.
 *
 * The colours come back through a contrast check before they touch the card.
 * Left alone, palette extraction will happily hand back mid-grey text on a
 * mid-grey background — and the owner, who is standing at their own counter
 * looking at their own brand, will not notice until a customer cannot read it.
 */
export async function POST(req: Request) {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')

  const form = await req.formData().catch(() => null)
  const kind = String(form?.get('kind') ?? 'logo')
  if (kind !== 'logo' && kind !== 'band') {
    return err('bad_request', 'Unknown image kind.')
  }
  const file = form?.get('logo') ?? form?.get('image')
  if (!(file instanceof File)) return err('bad_request', 'No image was uploaded.')
  if (file.size > MAX_BYTES) {
    return err('bad_request', 'That image is over 2 MB — try a smaller one.')
  }

  const original = Buffer.from(await file.arrayBuffer())

  let normalized: Buffer
  let width: number | undefined
  let height: number | undefined
  try {
    // Normalise to PNG and cap the size. A phone photo of a logo is often
    // 4000px wide, which is pointless on a card 160 points across.
    // A logo keeps its shape; band artwork is cropped to the card's band, so
    // there is no point storing more than that.
    const pipeline = kind === 'band'
      ? sharp(original).rotate().resize({
          width: 1125, height: 294, fit: 'cover', position: 'centre',
        }).png()
      : sharp(original).rotate().resize({
          width: 960, height: 960, fit: 'inside', withoutEnlargement: true,
        }).png()
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
    normalized = data
    width = info.width
    height = info.height
  } catch {
    return err('bad_request',
      `That file could not be read as an image. ${ACCEPTED.join(', ')} work best.`)
  }

  const asset = await one<{ id: string }>(
    `insert into assets (company_id, kind, mime, bytes, width, height)
     values ($1, $2, 'image/png', $3, $4, $5) returning id`,
    [ctx.company.id, kind, normalized, width ?? null, height ?? null],
  )
  const url = `/api/asset/${asset!.id}`

  if (kind === 'band') {
    await query(
      `update programs set band_image_url = $2, design_version = design_version + 1
        where id = $1`,
      [ctx.program.id, url],
    )
    return ok({ band_image_url: url })
  }

  // Only a logo sets the palette — band artwork is a backdrop, and taking the
  // card's colours from a photograph would wreck the contrast the logo earned.
  const palette = ensureReadable(await paletteFromLogo(normalized))
  await query(
    `update programs
        set logo_url = $2, bg_color = $3, fg_color = $4, label_color = $5,
            design_version = design_version + 1
      where id = $1`,
    [ctx.program.id, url, palette.bg, palette.fg, palette.label],
  )
  return ok({ logo_url: url, palette })
}
