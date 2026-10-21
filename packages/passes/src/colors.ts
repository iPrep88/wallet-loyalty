/**
 * Colour extraction, with a contrast gate.
 *
 * node-vibrant has no concept of legibility — left alone it will happily hand
 * back a mid-grey background with mid-grey text. Every extracted palette goes
 * through `ensureReadable` before it reaches a card.
 */
import Vibrant from 'node-vibrant'

export interface Palette {
  bg: string
  fg: string
  label: string
}

export const FALLBACK_PALETTE: Palette = {
  bg: '#1F2933',
  fg: '#FFFFFF',
  label: '#B8C2CC',
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Large text (the stamp count) needs 3:1; body text on the back needs 4.5:1. */
const MIN_CONTRAST_LARGE = 3
const MIN_CONTRAST_BODY = 4.5

/**
 * Keeps the extracted background, but replaces foreground/label with black or
 * white when the pairing would be hard to read. The shop's brand colour is the
 * part that matters to the owner; the text colour is ours to get right.
 */
export function ensureReadable(palette: Palette): Palette {
  const { bg } = palette
  const onLight = luminance(bg) > 0.4

  const fg = contrastRatio(bg, palette.fg) >= MIN_CONTRAST_LARGE
    ? palette.fg
    : onLight ? '#111111' : '#FFFFFF'

  const label = contrastRatio(bg, palette.label) >= MIN_CONTRAST_BODY
    ? palette.label
    : onLight ? '#3A3A3A' : '#E6E6E6'

  return { bg, fg, label }
}

/** Pulls a palette out of a logo. Never throws — falls back to the default. */
export async function paletteFromLogo(source: string | Buffer): Promise<Palette> {
  try {
    const swatches = await Vibrant.from(source as never).getPalette()
    const bg =
      swatches.Vibrant?.hex ?? swatches.DarkVibrant?.hex ?? swatches.Muted?.hex
    if (!bg) return FALLBACK_PALETTE

    return ensureReadable({
      bg,
      fg: swatches.LightMuted?.hex ?? '#FFFFFF',
      label: swatches.Muted?.hex ?? '#B8C2CC',
    })
  } catch {
    return FALLBACK_PALETTE
  }
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const n = Number.parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
