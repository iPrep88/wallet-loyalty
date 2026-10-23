/**
 * The Repio mark.
 *
 * An "r": one rounded arm turning the corner, and the dot tucked under it.
 * Kept as geometry rather than as a file so the same shape can be a favicon,
 * the logo in the header, and the signature drawn into card artwork — three
 * places that otherwise drift into three slightly different logos.
 *
 * Drawn in a 100x100 box. The arm is a STROKE, not a filled outline, which is
 * what gives it even weight and perfectly round caps at any size.
 */
export const MARK = {
  /** The arm: up the left, round the corner, out to the right. */
  arm: 'M32.75 70.25V49.45A18 18 0 0 1 50.75 31.45H67.25',
  armWidth: 14.5,
  dot: { cx: 56.5, cy: 52.5, r: 11.8 },
  /** Cropped to the mark itself, for a favicon that fills its tile. */
  viewBox: '23 23.8 54 54',
  blue: '#1D6EFE',
} as const

/** The mark's innards, for dropping inside an <svg> you have already opened. */
export function markSvg(color: string = MARK.blue, opacity?: number): string {
  const o = opacity === undefined ? '' : ` opacity="${opacity}"`
  return `<g${o}>`
    + `<path d="${MARK.arm}" fill="none" stroke="${color}"`
    + ` stroke-width="${MARK.armWidth}" stroke-linecap="round"/>`
    + `<circle cx="${MARK.dot.cx}" cy="${MARK.dot.cy}" r="${MARK.dot.r}" fill="${color}"/>`
    + `</g>`
}

/** A standalone square SVG document of the mark. */
export function markDocument(color: string = MARK.blue, background?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK.viewBox}">`
    + (background ? `<rect x="23" y="23.8" width="54" height="54" fill="${background}"/>` : '')
    + markSvg(color)
    + `</svg>`
}
