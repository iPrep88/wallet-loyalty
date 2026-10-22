import sharp from 'sharp'
import { iconPath } from './stamp-icons'
import type { StripRequest } from './types'

/**
 * The band across the card — the only surface on a wallet pass we actually
 * draw. Everything else (the name, the count, the reward wording) is laid out
 * by the operating system in its own system font, which is why none of it is
 * drawn here: SF Pro set by iOS will always look better than anything we
 * rasterise, and text baked into an image cannot adapt to the phone it lands
 * on.
 *
 * So this file has one job: make a stamp row that looks like someone designed
 * it. Three things do most of that work —
 *
 *   A ring is not a faded disc. An uncollected stamp drawn as a thin outline
 *   reads as "empty"; the same disc at 20% opacity reads as "smudged". This
 *   single change is most of the difference between cheap and considered.
 *
 *   A flat field looks printed, not lit. A barely-there tonal shift across the
 *   band gives it depth without anyone noticing a gradient.
 *
 *   Breathing room. Marks sized to the space they are in, not stretched to
 *   fill it.
 */
export async function renderStrip(req: StripRequest): Promise<Buffer> {
  const w = Math.round(req.width * (req.scale ?? 1))
  const h = Math.round(req.height * (req.scale ?? 1))

  // Photo mode: the merchant's picture is the ground, cropped by the part of
  // it that actually holds attention rather than its geometric middle — a
  // storefront photo has its subject off-centre more often than not.
  if (req.style === 'photo' && req.photo) {
    const base = await sharp(req.photo)
      .resize({ width: w, height: h, fit: 'cover', position: sharp.strategy.attention })
      .toBuffer()

    return sharp(base)
      .composite([{ input: Buffer.from(photoScrim(req, w, h)), blend: 'over' }])
      .png({ compressionLevel: 9 })
      .toBuffer()
  }

  return sharp(Buffer.from(stripSvg(req)))
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** The flat-ground version: a tonal field with the stamp row over it. */
export function stripSvg(req: StripRequest): string {
  const { bgColor, fgColor, state, scale = 1 } = req
  const w = Math.round(req.width * scale)
  const h = Math.round(req.height * scale)

  const ready = state === 'reward_ready'
  // On a ready card the two colours trade places, so the change is obvious at
  // arm's length without a word being written.
  const field = ready ? fgColor : bgColor
  const mark = ready ? bgColor : fgColor

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + defs(mark, w, h)
    + `<rect width="${w}" height="${h}" fill="${field}"/>`
    + `<rect width="${w}" height="${h}" fill="url(#lift)"/>`
    + stampRow(req, w, h, mark)
    + signature(w, h, mark)
    + `</svg>`
}

/**
 * The stamp row over a photograph.
 *
 * The scrim is a neutral darkening, NOT a wash of the brand colour — tinting
 * a picture with a pale brand erases it, which defeats the only reason this
 * mode exists. And the marks go white here regardless of the brand, because
 * white on a darkened photograph is legible over anything, where a brand
 * colour is a gamble against whatever the merchant happened to photograph.
 *
 * On a ready card the brand colour does come back, strongly — the state change
 * has to survive even when the ground is someone's storefront.
 */
function photoScrim(req: StripRequest, w: number, h: number): string {
  const ready = req.state === 'reward_ready'
  const mark = ready ? req.bgColor : '#FFFFFF'

  const layers = ready
    ? `<linearGradient id="scrim" x1="0" y1="1" x2="0" y2="0">`
      + `<stop offset="0" stop-color="${req.fgColor}" stop-opacity="0.93"/>`
      + `<stop offset="1" stop-color="${req.fgColor}" stop-opacity="0.82"/>`
      + `</linearGradient>`
    // Enough to carry white marks, little enough that the picture survives.
    : `<linearGradient id="scrim" x1="0" y1="1" x2="0" y2="0">`
      + `<stop offset="0" stop-color="#05070A" stop-opacity="0.58"/>`
      + `<stop offset="0.55" stop-color="#05070A" stop-opacity="0.42"/>`
      + `<stop offset="1" stop-color="#05070A" stop-opacity="0.3"/>`
      + `</linearGradient>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs>${layers}</defs>`
    + `<rect width="${w}" height="${h}" fill="url(#scrim)"/>`
    + stampRow(req, w, h, mark)
    + signature(w, h, mark)
    + `</svg>`
}

function defs(mark: string, w: number, h: number): string {
  return `<defs>`
    // Barely there on purpose: enough that the band is not a dead rectangle,
    // not enough that anyone would call it a gradient.
    + `<linearGradient id="lift" x1="0" y1="0" x2="0.35" y2="1">`
    + `<stop offset="0" stop-color="${mark}" stop-opacity="0.055"/>`
    + `<stop offset="0.6" stop-color="${mark}" stop-opacity="0.012"/>`
    + `<stop offset="1" stop-color="${mark}" stop-opacity="0"/>`
    + `</linearGradient>`
    + `</defs>`
}

function stampRow(req: StripRequest, w: number, h: number, mark: string): string {
  const { stamps, stampsRequired, icon, state } = req
  const ready = state === 'reward_ready'

  // Two rows only when a single one would make the marks too small to read.
  const rows = stampsRequired > 12 ? 2 : 1
  const perRow = Math.ceil(stampsRequired / rows)

  const padX = w * 0.055
  const cellW = (w - padX * 2) / perRow
  const cellH = (h * 0.82) / rows
  const size = Math.min(cellW * 0.68, cellH * 0.74)
  const r = size / 2
  const stroke = Math.max(1, size * 0.085)
  const unit = size / 100   // the icon paths are drawn in a 100-unit box

  const topOffset = (h - cellH * rows) / 2
  const out: string[] = []

  for (let i = 0; i < stampsRequired; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const cx = padX + cellW * col + cellW / 2
    const cy = topOffset + cellH * row + cellH / 2
    const filled = ready || i < stamps

    if (icon === 'circle') {
      out.push(filled
        // A collected stamp is solid and slightly larger — it should feel like
        // something landed there.
        ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${mark}"/>`
        // An empty one is an outline, never a faded fill.
        : `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r - stroke / 2)}" fill="none"`
          + ` stroke="${mark}" stroke-opacity="0.38" stroke-width="${n(stroke)}"/>`)
      continue
    }

    const x = cx - size / 2
    const y = cy - size / 2
    const transform = `translate(${n(x)} ${n(y)}) scale(${n(unit, 5)})`
    out.push(filled
      ? `<g transform="${transform}"><path d="${iconPath(icon)}" fill="${mark}"`
        + ` fill-rule="evenodd"/></g>`
      // Outlined rather than faded, for the same reason as the circles.
      : `<g transform="${transform}"><path d="${iconPath(icon)}" fill="none"`
        + ` stroke="${mark}" stroke-opacity="0.42"`
        + ` stroke-width="${n(stroke / unit)}" stroke-linejoin="round"`
        + ` fill-rule="evenodd"/></g>`)
  }

  return out.join('')
}

/**
 * Our mark, bottom right, at the opacity of a watermark.
 *
 * Drawn as shapes rather than set as text: at this size no typeface survives
 * rasterising, and the card belongs to the shop. A signature in the corner,
 * not a logo on the front.
 */
function signature(w: number, h: number, mark: string): string {
  const s = Math.max(7, h * 0.072)
  const x = w - s * 2.9
  const y = h - s * 1.75
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s / 24, 5)})" opacity="0.17">`
    + `<rect x="1.5" y="4.5" width="21" height="15" rx="3.5" fill="none"`
    + ` stroke="${mark}" stroke-width="2"/>`
    + `<path d="M1.5 9.5h21" stroke="${mark}" stroke-width="2"/>`
    + `</g>`
}

function n(value: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}
