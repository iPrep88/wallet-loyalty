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

  // Ramen: a bowl with a footed base, chopsticks laid across the top, three
  // strands hanging off them, and a slice of naruto resting on the broth.
  //
  // Every subpath is a closed shape, not a line. A collected stamp is drawn
  // fill-only, so a chopstick described as a stroke renders as nothing — which
  // is how two earlier attempts at this icon lost their chopsticks and went
  // back to reading as a cup of soup. Nothing overlaps anything else either:
  // the marks are filled with fill-rule evenodd, so two shapes crossing would
  // punch a hole where they meet rather than merge.
  bowl:
    // chopsticks — the near one level, the far one angled up to the right
    'M8 16 90 4l1 6-82 12z'
    + 'M8 24h84v6H8z'
    // three strands of noodles, hanging off them down to the broth
    // One long wave each rather than two short ones: at the size these ship
    // at, a tight zigzag closes up into a solid band and stops being noodles.
    + 'M13 30c-6 8 6 14 0 22h7c6-8-6-14 0-22z'
    + 'M28 30c-6 8 6 14 0 22h7c6-8-6-14 0-22z'
    + 'M43 30c-6 8 6 14 0 22h7c6-8-6-14 0-22z'
    // the naruto: a ring with a dot at its heart, cut off by the broth line
    + 'M64 52a14 14 0 0 1 28 0z'
    + 'M71 52a7 7 0 0 1 14 0z'
    + 'M75.5 52a2.5 2.5 0 0 1 5 0z'
    // the rim band, then the bowl, then its foot
    + 'M5 53h90v8H5z'
    + 'M10 64h80c0 15-13 26-29 26H39c-16 0-29-11-29-26z'
    + 'M41 91h18v3a3 3 0 0 1-3 3H44a3 3 0 0 1-3-3z',

  // A croissant: a fat crescent with three segment slivers cut through it.
  // The slivers are closed shapes so that fill-rule evenodd punches them out
  // of the body on a collected stamp, and draws them as lines on an empty one.
  // The first attempt was a smooth arc and read as a banana; the second put
  // the segments in as open lines, so they vanished when filled.
  croissant:
    'M6 76C6 34 26 13 50 13s44 21 44 63c-10-19-25-29-44-29S16 57 6 76z'
    + 'M27 24l5 2-3 30-5-2z'
    + 'M47 17h6v31h-6z'
    + 'M68 26l5-2 3 30-5 2z',

  // A scoop in a cone.
  scoop:
    'M50 12a26 26 0 0 1 26 26H24a26 26 0 0 1 26-26z'
    + 'M26 44h48L50 94z',

  // A coffee bean: ellipse with the centre crease. The crease is a closed
  // sliver for the same reason the croissant's segments are.
  bean:
    'M50 8c20 0 36 19 36 42S70 92 50 92 14 73 14 50 30 8 50 8z'
    + 'M53 13c-8 11-8 28 0 37s8 26 0 37l-6-3c7-10 7-25 0-34s-7-27 0-38z',
}

/**
 * The mark for the reward box — the last cell on a card that ends in the prize
 * rather than in another stamp. Deliberately not one of the stamp icons: the
 * whole point of the last box is that it is not the same as the nine before
 * it. A present reads as "the thing you are working towards" to anyone,
 * in any language, at the size of a fingernail.
 */
export const REWARD_PATH =
  // lid
  'M5 30h90v20H5z'
  // box, sitting just under the lid so the gap gives it an edge
  + 'M14 54h72v40H14z'
  // the bow, two loops above the lid
  + 'M50 30C41 28 29 23 29 14s12-9 21 16z'
  + 'M50 30C59 28 71 23 71 14s-12-9-21 16z'

export function iconPath(icon: StampIcon): string {
  return icon === 'custom' ? PATHS.circle : PATHS[icon]
}
