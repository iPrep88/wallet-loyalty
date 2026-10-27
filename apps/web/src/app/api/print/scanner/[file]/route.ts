import QRCode from 'qrcode'
import { one } from '@wl/db'

/**
 * A QR that opens the staff scanner on whichever phone scans it.
 *
 * The counter code is for customers; this one is for the shop. An owner
 * standing at their till is not going to type
 * tryrepio.com/scan?store=their-slug into a phone keyboard, and if getting
 * the scanner onto the counter device is fiddly it simply never happens.
 *
 * Deliberately plain black on white with no branding: this is scanned once,
 * by one person, from a laptop screen — legibility is the only thing that
 * matters and brand colour only costs contrast.
 */
export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params
  const match = /^([a-z0-9-]{1,80})\.png$/.exec(file)
  if (!match) return new Response('Bad image name', { status: 400 })
  const slug = match[1]!

  const store = await one<{ slug: string }>(
    `select slug from stores where slug = $1 and active`, [slug],
  )
  if (!store) return new Response('Not found', { status: 404 })

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const png = await QRCode.toBuffer(`${origin}/scan?store=${store.slug}`, {
    width: 420,
    margin: 1,
    color: { dark: '#111111', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // Short: an owner who renames their shop wants the new link today.
      'Cache-Control': 'public, max-age=60',
    },
  })
}
