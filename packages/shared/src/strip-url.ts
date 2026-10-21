/**
 * The public path for a stamp strip image.
 *
 * Pure string building, deliberately kept out of the renderer package: a page
 * that only needs the URL should not pull `sharp` into its bundle.
 *
 * Every input that changes a pixel is a path segment, so the response can be
 * cached forever — and an owner editing their card busts every member's image
 * at once by bumping design_version. Nothing goes in the query string, because
 * a `force-static` route handler never sees it.
 *
 * `strip` is Apple's short pass strip; `hero` is Google's wide 3:1 banner.
 */
export function stripPath(args: {
  programId: string
  designVersion: number
  state: 'collecting' | 'reward_ready'
  count: number
  size?: 'strip' | 'hero'
  scale?: 1 | 2 | 3
}): string {
  const { programId, designVersion, state, count, size = 'strip', scale = 1 } = args
  const suffix = scale === 1 ? '' : `@${scale}x`
  return `/api/strip/${programId}/${designVersion}/${state}/${size}/${count}${suffix}.png`
}
