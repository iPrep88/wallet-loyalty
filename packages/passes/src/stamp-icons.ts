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

  // A croissant: five lobes along a curling spine, drawn as five separate
  // shapes with gaps between them rather than one outline with cut lines.
  //
  // Two things make it a croissant and not a melon slice. The outer edge of
  // every lobe bulges in its middle, so the silhouette is scalloped; and both
  // tips taper almost to a point, so it curls. An earlier version was a
  // smooth arc and read as a banana; the one after it put the segments in as
  // open lines, which render as nothing at all on a collected stamp.
  //
  // Generated from a quadratic spine and a width profile, then frozen here —
  // there is no reason to carry the generator into the bundle for a shape
  // that will never change at runtime.
  croissant:
    'M11.8 78.0 13.9 79.1 16.0 81.2 18.1 83.7 20.3 85.8 22.6 86.5 24.9 86.8 27.1 87.2 29.4 87.7 31.6 88.0 33.8 88.2 31.6 64.6 30.0 65.6 28.4 66.6 26.6 67.4 24.8 68.0 23.0 68.2 21.0 68.7 19.0 70.2 16.8 72.1 14.5 73.5 12.2 74.0z'
    + 'M40.8 90.0 43.3 90.9 45.8 91.4 48.3 91.8 50.9 92.1 53.4 92.1 55.8 91.8 58.2 91.1 60.3 90.0 62.2 88.5 64.0 86.7 45.8 53.3 44.9 53.8 44.1 54.4 43.2 55.2 42.4 56.1 41.5 57.0 40.5 58.0 39.4 58.9 38.3 59.7 37.0 60.3 35.7 61.3z'
    + 'M70.1 83.5 73.1 83.1 76.1 82.5 79.0 81.6 81.7 80.3 84.0 78.6 85.9 76.5 87.3 73.9 88.2 71.1 88.5 67.9 88.6 64.7 55.4 43.2 54.1 43.8 52.8 44.3 51.9 44.9 51.1 45.6 50.4 46.4 49.9 47.3 49.4 48.2 49.0 49.3 48.5 50.3 48.0 51.4z'
    + 'M91.0 58.0 92.7 56.5 94.4 54.9 95.8 53.2 97.0 51.3 97.9 49.3 98.0 47.0 97.5 44.5 96.5 41.9 95.2 39.3 93.8 36.7 67.5 30.0 65.8 31.2 64.2 32.3 62.7 33.3 61.4 34.3 60.5 35.3 60.1 36.5 59.6 37.7 59.2 38.8 58.7 39.8 58.3 40.9z'
    + 'M93.0 29.3 93.9 27.6 94.6 25.9 94.5 24.0 93.6 22.0 92.2 20.0 90.5 17.9 88.8 15.9 87.3 13.9 86.4 12.0 86.0 10.1 82.0 9.9 81.5 11.7 80.5 13.4 79.0 15.0 77.2 16.6 75.4 18.0 73.7 19.4 72.3 20.8 71.5 22.2 71.2 23.7 71.0 25.2z',

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
