import sharp from 'sharp'
import { one } from '@wl/db'

/**
 * A stand-in logo, for a shop that has not uploaded one.
 *
 * Google requires a programLogo on every loyalty class — a card cannot exist
 * without one — and the "ready-made card" path deliberately lets an owner
 * skip the upload. So rather than refuse to make their card, we draw them a
 * monogram in their own colours. It is their initials on their card, not a
 * blank square and not our logo on their shop.
 *
 * Immutable for the same reason the stamp artwork is: every input that
 * changes a pixel is in the path, and design_version moves when the colours
 * or the name do.
 */
export const dynamic = 'force-static'
export const revalidate = false

const SIZE = 660
const FONT = 'DejaVu Sans, Helvetica, Arial, sans-serif'

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
    design_version: number
  }>(
    `select c.name, p.bg_color, p.fg_color, p.design_version
       from programs p
       join companies c on c.id = p.company_id
      where p.id = $1`,
    [programId],
  )
  if (!row) return new Response('Not found', { status: 404 })

  // A stale version must not render, or the CDN keeps a logo in colours the
  // shop has since changed.
  if (Number(designVersion) !== row.design_version) {
    return new Response('Stale design version', { status: 404 })
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">`
    + `<rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 0.22}" fill="${row.bg_color}"/>`
    + `<text x="${SIZE / 2}" y="${SIZE / 2}" text-anchor="middle"`
    + ` dominant-baseline="central" fill="${row.fg_color}"`
    + ` font-family="${FONT}" font-size="${SIZE * 0.42}" font-weight="bold"`
    + ` letter-spacing="${SIZE * 0.01}">${initials(row.name)}</text>`
    + `</svg>`

  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()

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
