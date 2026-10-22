import sharp from 'sharp'
import { one, query } from '@wl/db'
import { ownerContext } from '@/lib/owner-data'
import { paletteFromAnalysis } from '@wl/passes/colors'
import { analyzeLogo, trimLogo } from '@wl/passes/logo'
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
  if (kind !== 'logo' && kind !== 'photo') {
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
    // A photograph is stored large enough to crop from at render time; the
    // owner never picks a crop, because the whole point is that they are not
    // doing the design.
    //
    // A logo is trimmed first: one exported with a wide margin otherwise
    // arrives as a small mark adrift in a transparent box, and lands on the
    // card looking misaligned rather than small.
    const source = kind === 'photo' ? original : await trimLogo(original)
    const { data, info } = await sharp(source).rotate().resize(
      kind === 'photo'
        ? { width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }
        : { width: 960, height: 960, fit: 'inside', withoutEnlargement: true },
    ).png().toBuffer({ resolveWithObject: true })
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

  if (kind === 'photo') {
    // A photograph never sets the palette. Colours come from the logo, which
    // is the brand; a picture of a croissant is not.
    await query(
      `update programs
          set photo_url = $2, card_style = 'photo', design_version = design_version + 1
        where id = $1`,
      [ctx.program.id, url],
    )
    return ok({ photo_url: url })
  }

  // The brand colour becomes the card's ACCENT, never its background — a
  // transparent logo's dominant colour is its own ink, and using that as the
  // ground puts a blue logo on a blue card.
  const palette = paletteFromAnalysis(await analyzeLogo(normalized))
  await query(
    `update programs
        set logo_url = $2, bg_color = $3, fg_color = $4, label_color = $5,
            design_version = design_version + 1
      where id = $1`,
    [ctx.program.id, url, palette.bg, palette.fg, palette.label],
  )
  return ok({ logo_url: url, palette })
}
