import sharp from 'sharp'
import { one } from '@wl/db'
import { trimLogo } from '@wl/passes/logo'
import { ART_VERSION } from '@wl/shared/strip-url'

/**
 * The logo Google gets.
 *
 * Google draws a loyalty class's programLogo inside a CIRCLE, and hands it a
 * square. A square cropped to a circle keeps only its inscribed square —
 * about 70% of the width — so a logo sent as-is has its corners cut off and a
 * wide wordmark ends up tiny and clipped. That is what happened to iPrep's.
 *
 * So the shop's logo is never passed straight through. It is fitted inside
 * the part of the tile that survives the crop, centred, on a clean ground.
 * A shop with no logo at all gets a monogram instead — Google marks
 * programLogo as required, and the "ready-made card" path deliberately never
 * asks for an upload, so refusing to make their card was not an option.
 *
 * Immutable for the same reason the stamp artwork is: every input that
 * changes a pixel is in the path, and design_version moves when the colours,
 * the name or the logo do.
 */
export const dynamic = 'force-static'
export const revalidate = false

const SIZE = 660
const FONT = 'DejaVu Sans, Helvetica, Arial, sans-serif'

/**
 * How much of the circle the logo's DIAGONAL may span.
 *
 * Not a box. A box is what makes this go wrong, and it goes wrong in
 * opposite directions depending on the shape of the logo: fit a 5:1 wordmark
 * into a square box and it ends up a thin line across the middle with half
 * the circle empty; fit a square mark into the same box and it presses
 * against the rim.
 *
 * The actual condition for a mark to sit inside a circle is
 * (w/2)² + (h/2)² ≤ r² — its diagonal has to fit the diameter. So the
 * diagonal is what gets scaled, and every shape then clears the edge by the
 * same amount, whether the shop's logo is a wordmark, a square badge, a tall
 * crest or a roundel.
 *
 * 0.80 leaves that clearance visible. A mark touching the edge of a circle
 * reads as cropped even when it is not.
 */
const DIAGONAL_SPAN = 0.80

export async function GET(
  _req: Request,
  ctx: {
    params: Promise<{ programId: string; designVersion: string; file: string }>
  },
) {
  const { programId, designVersion, file } = await ctx.params
  if (file !== 'logo.png') return new Response('Bad image name', { status: 400 })

  const row = await one<{
    name: string
    bg_color: string
    fg_color: string
    logo_url: string | null
    design_version: number
  }>(
    `select c.name, p.bg_color, p.fg_color, p.logo_url, p.design_version
       from programs p
       join companies c on c.id = p.company_id
      where p.id = $1`,
    [programId],
  )
  if (!row) return new Response('Not found', { status: 404 })

  // Two halves, as with the stamp artwork: what the OWNER last changed, and
  // which generation of our own drawing produced it. Without the second, a
  // fix to how we fit a logo never reaches a card that already has one.
  const [ownerVersion, artVersion] = designVersion.split('-')
  if (Number(ownerVersion) !== row.design_version
      || artVersion !== String(ART_VERSION)) {
    return new Response('Stale design version', { status: 404 })
  }

  const logo = await loadLogo(row.logo_url)

  let png: Buffer
  if (logo) {
    // Trim FIRST, and this is the whole trick. Two shops uploaded the same
    // iPrep wordmark and got wildly different results: one file carried
    // whitespace around the mark, the other was cropped tight, so scaling
    // each "to fit" made one small and the other pressed against the edge of
    // the circle. Cutting the surrounding space off first means the MARK is
    // what gets sized, not whatever border its file happened to have.
    const trimmed = await trimLogo(logo)

    // Size by the diagonal, so the result does not depend on whether this
    // particular shop's logo happens to be wide, tall or square.
    const meta = await sharp(trimmed).metadata()
    const w = meta.width ?? SIZE
    const h = meta.height ?? SIZE
    const scale = (SIZE * DIAGONAL_SPAN) / Math.hypot(w, h)

    // White, not the brand colour: a logo is designed to sit on white, and a
    // dark mark dropped onto a dark brand background disappears inside a
    // 40-pixel circle.
    const fitted = await sharp(trimmed)
      .resize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), {
        fit: 'inside',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .toBuffer()
    png = await sharp({
      create: { width: SIZE, height: SIZE, channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([{ input: fitted, gravity: 'centre' }])
      .png({ compressionLevel: 9 })
      .toBuffer()
  } else {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">`
      + `<rect width="${SIZE}" height="${SIZE}" fill="${row.bg_color}"/>`
      + `<text x="${SIZE / 2}" y="${SIZE / 2}" text-anchor="middle"`
      + ` dominant-baseline="central" fill="${row.fg_color}"`
      + ` font-family="${FONT}" font-size="${SIZE * 0.34}" font-weight="bold"`
      + ` letter-spacing="${SIZE * 0.01}">${initials(row.name)}</text>`
      + `</svg>`
    png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
  }

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

/**
 * Two letters at most. "Bubble Tea Co" is BT, "Repio" is R — three letters at
 * this size start to read as a word rather than a mark.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length >= 2
    ? [words[0]![0], words[1]![0]]
    : [...(words[0] ?? '?')].slice(0, 2)
  return letters.join('').toUpperCase()
    .replace(/[<>&"']/g, '')   // it lands inside an SVG document
    || '?'
}

/** The uploaded logo's bytes, straight from the asset table — no HTTP round
 *  trip back into our own server to fetch something we already hold. */
async function loadLogo(logoUrl: string | null): Promise<Buffer | null> {
  if (!logoUrl) return null
  const id = logoUrl.split('/').pop()
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const asset = await one<{ bytes: Buffer }>(
    `select bytes from assets where id = $1`, [id],
  )
  return asset?.bytes ?? null
}
