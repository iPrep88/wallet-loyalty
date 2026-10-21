import sharp from 'sharp'
import { iconPath } from './stamp-icons'
import type { StripRequest } from './types'

/**
 * Renders the stamp grid.
 *
 * Deliberately text-free. Adding a word would mean shipping a font: librsvg
 * renders SVG text with whatever fonts the host happens to have, and a serverless
 * Linux box has almost none, so text that looks right on a Mac silently
 * disappears in production. The reward wording already lives in a pass field,
 * where the OS draws it properly — so the image stays pure shapes.
 *
 * Reward-ready inverts the colours instead of captioning itself, which reads as
 * a clear flip at a glance and needs no glyphs.
 */
export async function renderStrip(req: StripRequest): Promise<Buffer> {
  return sharp(Buffer.from(stripSvg(req)))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()
}

export function stripSvg(req: StripRequest): string {
  const {
    stamps, stampsRequired, state, icon,
    bgColor, fgColor, width, height, scale = 1,
  } = req

  const ready = state === 'reward_ready'
  // The flip: on a ready card the brand colour becomes the mark and the mark
  // colour becomes the field.
  const field = ready ? fgColor : bgColor
  const mark = ready ? bgColor : fgColor

  const w = width * scale
  const h = height * scale

  // Two rows once a single row would squeeze the stamps too small to read.
  const rows = stampsRequired > 12 ? 2 : 1
  const perRow = Math.ceil(stampsRequired / rows)

  const padX = w * 0.035
  const padY = h * 0.1
  const cellW = (w - padX * 2) / perRow
  const cellH = (h - padY * 2) / rows
  // 100 is the icon path's design box.
  const size = Math.min(cellW, cellH) * 0.86
  const unit = size / 100

  const marks: string[] = []
  for (let i = 0; i < stampsRequired; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const cx = padX + cellW * col + cellW / 2
    const cy = padY + cellH * row + cellH / 2
    const x = cx - size / 2
    const y = cy - size / 2

    const filled = ready || i < stamps
    marks.push(
      `<g transform="translate(${r(x)} ${r(y)}) scale(${r(unit, 5)})">`
      + `<path d="${iconPath(icon)}" fill="${mark}"`
      + ` fill-opacity="${filled ? 1 : 0.2}"`
      + ` fill-rule="evenodd"/>`
      + `</g>`,
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r(w)}" height="${r(h)}"`
    + ` viewBox="0 0 ${r(w)} ${r(h)}">`
    + `<rect width="${r(w)}" height="${r(h)}" fill="${field}"/>`
    + marks.join('')
    + `</svg>`
}

function r(n: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}
