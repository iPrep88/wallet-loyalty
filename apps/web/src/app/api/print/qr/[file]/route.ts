import QRCode from 'qrcode'
import sharp from 'sharp'
import { one } from '@wl/db'
import { contrastRatio } from '@wl/passes/colors'
import { dealQualifier } from '@wl/shared/rewards'

/**
 * The counter stand — the single most important printed object in the
 * product. If this is not sitting next to a till, nothing else works.
 *
 * Rendered here rather than in the browser so it can be printed, emailed or
 * handed over as a file. Text is fine in this one (unlike the card artwork):
 * it is drawn once, and both this Mac and the Linux server have a sans-serif
 * to fall back on — hence the explicit stack rather than a bare family name.
 */
export const dynamic = 'force-dynamic'

const W = 900, H = 1200
// Unquoted family names on purpose: quoting them inside an SVG attribute
// needs XML escaping, and getting that subtly wrong breaks the whole
// document rather than just the font. DejaVu is what the Linux server has;
// Helvetica is what this Mac has.
const FONT = 'DejaVu Sans, Helvetica, Arial, sans-serif'

export async function GET(
  req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params
  const slug = file.replace(/\.png$/, '')

  const row = await one<{
    store_name: string
    company_name: string
    reward_text: string
    stamps_required: number
    reward_in_grid: boolean
    bg_color: string
    fg_color: string
    label_color: string
  }>(
    `select s.name as store_name, c.name as company_name,
            p.reward_text, p.stamps_required, p.reward_in_grid,
            p.bg_color, p.fg_color, p.label_color
       from stores s
       join companies c on c.id = s.company_id
       join programs  p on p.company_id = c.id
      where s.slug = $1 and s.active`,
    [slug],
  )
  if (!row) return new Response('Not found', { status: 404 })

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const joinUrl = `${origin}/j/${slug}`

  // The code itself is drawn in the brand colour only when that colour is
  // dark enough to read as a code. A pale brand on white is roughly 1.5:1,
  // which scanners fail on a dim counter — and a code that needs three
  // attempts is worse than one that is not on brand. 7:1 is the floor.
  const brandScans = contrastRatio(row.bg_color, '#FFFFFF') >= 7
  const qr = await QRCode.toBuffer(joinUrl, {
    width: 560, margin: 1,
    color: { dark: brandScans ? row.bg_color : '#111111', light: '#FFFFFF' },
    // Printed codes get scuffed, smudged and photographed at an angle.
    errorCorrectionLevel: 'Q',
  })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${row.bg_color}"/>
    <text x="${W / 2}" y="148" text-anchor="middle" fill="${row.fg_color}"
          font-family="${FONT}" font-size="58" font-weight="bold"
      >${esc(fit(row.company_name, 22))}</text>
    <text x="${W / 2}" y="208" text-anchor="middle" fill="${row.label_color}"
          font-family="${FONT}" font-size="30"
      >Scan to start your stamp card</text>
    <rect x="140" y="268" width="620" height="620" rx="26" fill="#FFFFFF"/>
    <text x="${W / 2}" y="978" text-anchor="middle" fill="${row.fg_color}"
          font-family="${FONT}" font-size="50" font-weight="bold"
      >${esc(fit(row.reward_text, 24))}</text>
    <text x="${W / 2}" y="1032" text-anchor="middle" fill="${row.label_color}"
          font-family="${FONT}" font-size="30"
      >${esc(dealQualifier(row.stamps_required, row.reward_in_grid))}</text>
    <text x="${W / 2}" y="1126" text-anchor="middle" fill="${row.label_color}"
          font-family="${FONT}" font-size="22" opacity="0.6"
      >No app. No account. Just scan.</text>
  </svg>`

  const png = await sharp(Buffer.from(svg))
    .composite([{ input: qr, top: 298, left: 170 }])
    .png()
    .toBuffer()

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // Short cache: an owner who changes their reward wants a new stand now,
      // not tomorrow.
      'Cache-Control': 'public, max-age=60',
    },
  })
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Long names would run off a printed page; cut rather than overflow. */
function fit(s: string, max: number): string {
  const t = s.trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}
