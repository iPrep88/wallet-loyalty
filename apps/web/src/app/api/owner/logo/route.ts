import { one, query } from '@wl/db'
import { ownerContext } from '@/lib/owner-data'
import { paletteFromAnalysis } from '@wl/passes/colors'
import { analyzeLogo } from '@wl/passes/logo'
import { MAX_UPLOAD_BYTES, processUpload } from '@/lib/images'
import { err, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'


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
  if (file.size > MAX_UPLOAD_BYTES) {
    return err('bad_request',
      `That image is over ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`)
  }

  const processed = await processUpload(Buffer.from(await file.arrayBuffer()), kind)
  if (!processed.ok) return err('bad_request', processed.message)
  const { bytes: normalized, mime, width, height } = processed.image
  const asset = await one<{ id: string }>(
    `insert into assets (company_id, kind, mime, bytes, width, height)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [ctx.company.id, kind, mime, normalized, width, height],
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
