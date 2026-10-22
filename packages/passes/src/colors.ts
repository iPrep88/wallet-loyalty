/**
 * Choosing a card's colours.
 *
 * Two rules, and both were learned the hard way:
 *
 *  1. The logo must be visible on the card. Taking a transparent logo's
 *     dominant colour and making it the background puts a blue logo on a blue
 *     card. The brand colour is the ACCENT; the background is whatever lets
 *     that accent be seen.
 *
 *  2. An opaque logo brings its own background. Fighting it produces a pasted
 *     white square in the corner, so the card matches it instead and the logo
 *     blends into the design.
 */
import type { LogoAnalysis } from './logo'
export { CARD_TEMPLATES, type CardTemplateId } from '@wl/shared/constants'

export interface Palette {
  bg: string
  fg: string
  label: string
}

export const FALLBACK_PALETTE: Palette = {
  bg: '#14181F', fg: '#F2F4F7', label: '#8E97A3',
}

// ------------------------------------------------------------- contrast
function parse(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = Number.parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function luminance(hex: string): number {
  const { r, g, b } = parse(hex)
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const MIN_CONTRAST_LARGE = 3     // the stamp count
const MIN_CONTRAST_BODY = 4.5    // wording on the back
const MIN_CONTRAST_LOGO = 2.5    // a mark only has to be distinguishable

/** Keeps the background; replaces text colours that would be hard to read. */
export function ensureReadable(palette: Palette): Palette {
  const { bg } = palette
  const onLight = luminance(bg) > 0.4

  const fg = contrastRatio(bg, palette.fg) >= MIN_CONTRAST_LARGE
    ? palette.fg : onLight ? '#111111' : '#FFFFFF'
  const label = contrastRatio(bg, palette.label) >= MIN_CONTRAST_BODY
    ? palette.label : onLight ? '#3A3A3A' : '#E6E6E6'

  return { bg, fg, label }
}

/**
 * Guarantees the logo can be seen.
 *
 * If the card background is too close to the logo's own ink, the background
 * moves to the far end instead — which is what a designer would do, and what
 * an owner means when they say "blue logo, white card, or white logo, blue
 * card".
 */
export function ensureLogoVisible(palette: Palette, ink: string): Palette {
  if (contrastRatio(palette.bg, ink) >= MIN_CONTRAST_LOGO) return palette
  const inkIsDark = luminance(ink) < 0.45
  return ensureReadable({
    ...palette,
    bg: inkIsDark ? '#FBFBFA' : '#14181F',
  })
}

/**
 * The palette a logo deserves.
 *
 * Never returns the logo's ink as the background — see rule 1 above.
 */
export function paletteFromAnalysis(a: LogoAnalysis): Palette {
  // An opaque logo carries its own background: match it, so the logo sits on
  // the card rather than on a rectangle of its own.
  if (!a.hasTransparency && a.backdrop) {
    const bg = a.backdrop
    const onLight = luminance(bg) > 0.4
    return ensureLogoVisible(ensureReadable({
      bg,
      fg: onLight ? '#111111' : '#FFFFFF',
      label: onLight ? '#5A5F66' : '#C9CFD6',
    }), a.ink)
  }

  // A transparent logo is pure brand ink. The card supplies a ground that ink
  // reads against — barely tinted toward the ink so it still feels like one
  // design rather than a logo dropped onto a stranger's card.
  const bg = a.inkIsDark ? tint(a.ink, 0.94) : shade(a.ink, 0.86)
  const onLight = luminance(bg) > 0.4
  return ensureLogoVisible(ensureReadable({
    bg,
    fg: onLight ? '#15181C' : '#F7F8FA',
    label: onLight ? '#5A5F66' : '#AEB6BF',
  }), a.ink)
}

/** Mixes toward white by `amount` (0 = unchanged, 1 = white). */
function tint(hex: string, amount: number): string {
  const { r, g, b } = parse(hex)
  return rgb(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

/** Mixes toward near-black by `amount`. */
function shade(hex: string, amount: number): string {
  const { r, g, b } = parse(hex)
  const floor = 18
  return rgb(r + (floor - r) * amount, g + (floor - g) * amount, b + (floor - b) * amount)
}

function rgb(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16)
    .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}
