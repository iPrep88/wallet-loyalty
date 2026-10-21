import type { StampIcon } from './types'

/**
 * Each icon is an SVG path drawn inside a 100x100 box, so the renderer can
 * scale one shape to whatever cell size the strip happens to allow.
 */
const PATHS: Record<Exclude<StampIcon, 'custom'>, string> = {
  circle: 'M50 6a44 44 0 1 0 0 88 44 44 0 0 0 0-88z',

  star:
    'M50 4 62.6 36.5 97 39.2 70.8 61.8 78.9 95 50 77.2 21.1 95 29.2 61.8 3 39.2 37.4 36.5z',

  heart:
    'M50 92C50 92 8 66 8 38A22 22 0 0 1 50 26A22 22 0 0 1 92 38C92 66 50 92 50 92z',

  // A takeaway cup: lid, tapered body.
  cup:
    'M22 20h56l-3 10H25zM27 34h46l-6 54a6 6 0 0 1-6 5H39a6 6 0 0 1-6-5z',

  // Same cup, with boba pearls settled in the bottom.
  boba:
    'M22 20h56l-3 10H25zM27 34h46l-6 54a6 6 0 0 1-6 5H39a6 6 0 0 1-6-5z'
    + 'M40 74a5 5 0 1 0 0.1 0zM54 78a5 5 0 1 0 0.1 0zM47 66a5 5 0 1 0 0.1 0z',

  // A coffee bean: ellipse with the centre crease.
  bean:
    'M50 8c20 0 36 19 36 42S70 92 50 92 14 73 14 50 30 8 50 8z'
    + 'M50 14c-7 9-7 27 0 36s7 27 0 36',
}

export function iconPath(icon: StampIcon): string {
  return icon === 'custom' ? PATHS.circle : PATHS[icon]
}
