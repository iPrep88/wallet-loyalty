import sharp from 'sharp'
import { iconPath } from './stamp-icons'
import type { StripRequest } from './types'

/**
 * Renders the band across the card, in one of three styles.
 *
 * Deliberately text-free. Adding a word would mean shipping a font: image text
 * is drawn with whatever fonts the host happens to have, and a serverless
 * Linux box has almost none, so text that looks right on a Mac silently
 * disappears in production. The reward wording already lives in a pass field,
 * where the phone draws it properly — so this stays pure shapes.
 *
 * Reward-ready inverts the colours rather than captioning itself, which reads
 * as a clear flip at a glance and needs no glyphs.
 */
export async function renderStrip(req: StripRequest): Promise<Buffer> {
  return sharp(Buffer.from(stripSvg(req)))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()
}

export function stripSvg(req: StripRequest): string {
  const { bgColor, fgColor, width, height, scale = 1, state, style = 'stamps' } = req

  const ready = state === 'reward_ready'
  // The flip: on a ready card the brand colour becomes the mark and the mark
  // colour becomes the field.
  const field = ready ? fgColor : bgColor
  const mark = ready ? bgColor : fgColor

  const w = width * scale
  const h = height * scale

  const body =
    style === 'progress' ? progressBar(req, w, h, mark)
  : style === 'minimal'  ? ''            // the count lives in a pass field
  : /* stamps */           stampGrid(req, w, h, mark)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r(w)}" height="${r(h)}"`
    + ` viewBox="0 0 ${r(w)} ${r(h)}">`
    + `<rect width="${r(w)}" height="${r(h)}" fill="${field}"/>`
    + body
    + `</svg>`
}

/** Icons across the band, filling up as they collect. The classic. */
function stampGrid(req: StripRequest, w: number, h: number, mark: string): string {
  const { stamps, stampsRequired, icon, state } = req
  const ready = state === 'reward_ready'

  // Two rows once a single row would squeeze the icons too small to read.
  const rows = stampsRequired > 12 ? 2 : 1
  const perRow = Math.ceil(stampsRequired / rows)

  const padX = w * 0.035
  const padY = h * 0.1
  const cellW = (w - padX * 2) / perRow
  const cellH = (h - padY * 2) / rows
  const size = Math.min(cellW, cellH) * 0.86
  const unit = size / 100   // 100 is the icon path's design box

  const marks: string[] = []
  for (let i = 0; i < stampsRequired; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const x = padX + cellW * col + cellW / 2 - size / 2
    const y = padY + cellH * row + cellH / 2 - size / 2
    const filled = ready || i < stamps
    marks.push(
      `<g transform="translate(${r(x)} ${r(y)}) scale(${r(unit, 5)})">`
      + `<path d="${iconPath(icon)}" fill="${mark}" fill-opacity="${filled ? 1 : 0.2}"`
      + ` fill-rule="evenodd"/></g>`,
    )
  }
  return marks.join('')
}

/** A bar that fills. Between the grid and the minimal. */
function progressBar(req: StripRequest, w: number, h: number, mark: string): string {
  const { stamps, stampsRequired, state } = req
  const fraction = state === 'reward_ready'
    ? 1
    : Math.max(0, Math.min(1, stamps / Math.max(stampsRequired, 1)))

  const padX = w * 0.07
  const barW = w - padX * 2
  const barH = Math.min(h * 0.22, 26 * (w / 375))
  const y = h / 2 - barH / 2
  const radius = barH / 2

  // Ticks mark each stamp, so the bar still says how many are left — without
  // that it is just a vague sense of progress.
  const ticks: string[] = []
  for (let i = 1; i < stampsRequired; i++) {
    const x = padX + (barW * i) / stampsRequired
    ticks.push(`<rect x="${r(x - 0.5)}" y="${r(y)}" width="1" height="${r(barH)}"`
      + ` fill="${mark}" fill-opacity="0.25"/>`)
  }

  return `<rect x="${r(padX)}" y="${r(y)}" width="${r(barW)}" height="${r(barH)}"`
    + ` rx="${r(radius)}" fill="${mark}" fill-opacity="0.2"/>`
    + (fraction > 0
      ? `<rect x="${r(padX)}" y="${r(y)}" width="${r(Math.max(barW * fraction, barH))}"`
        + ` height="${r(barH)}" rx="${r(radius)}" fill="${mark}"/>`
      : '')
    + ticks.join('')
}

function r(n: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}
