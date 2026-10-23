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

  // A noodle bowl with chopsticks lifting a strand out of it.
  //
  // Every subpath here is a closed shape, not a line. A collected stamp is
  // drawn fill-only, so a chopstick described as a stroke renders as nothing —
  // which is exactly how the first two attempts at this icon lost their
  // chopsticks and went back to reading as a cup of soup.
  bowl:
    // the bowl
    'M7 50h86c0 23-19 42-43 42S7 73 7 50z'
    // two chopsticks, as slim quadrilaterals angled out to the upper right
    + 'M41 47 83 9l5 5-42 38z'
    + 'M50 54 92 16l5 5-42 38z'
    // a strand draping off them back down toward the bowl
    + 'M57 36c-8 11-7 22 3 30l-6 4c-13-10-14-25-4-38z',

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
