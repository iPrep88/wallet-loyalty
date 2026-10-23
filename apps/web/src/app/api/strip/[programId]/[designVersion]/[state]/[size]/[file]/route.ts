import { one, type Program } from '@wl/db'
import { renderStrip } from '@wl/passes/strip'
import type { CardState, CardStyle, StampIcon } from '@wl/passes/types'
import { APPLE_STRIP, GOOGLE_HERO, ART_VERSION } from '@wl/shared'

/**
 * The stamp strip, as an immutable public image.
 *
 * Every input that changes a pixel is a PATH segment — programId,
 * designVersion, state, size and count. Nothing lives in the query string: a
 * `force-static` route handler is not given searchParams at all, and a URL
 * promising `immutable` should not quietly vary by query anyway.
 *
 * Apple embeds these bytes into the signed pass and needs the short strip;
 * Google points at this URL as a wide 3:1 hero image. Hence the size segment.
 */
export const dynamic = 'force-static'
export const revalidate = false

export async function GET(
  _req: Request,
  ctx: {
    params: Promise<{
      programId: string
      designVersion: string
      state: string
      size: string
      file: string
    }>
  },
) {
  const { programId, designVersion, state, size, file } = await ctx.params

  // "7.png", "7@2x.png", "7@3x.png"
  const match = /^(\d+)(?:@([123])x)?\.png$/.exec(file)
  if (!match) return new Response('Bad image name', { status: 400 })
  const count = Number(match[1])
  const scale = Number(match[2] ?? '1')

  if (state !== 'collecting' && state !== 'reward_ready') {
    return new Response('Bad state', { status: 400 })
  }
  if (size !== 'strip' && size !== 'hero') {
    return new Response('Bad size', { status: 400 })
  }

  const program = await one<Program>(`select * from programs where id = $1`, [programId])
  if (!program) return new Response('Not found', { status: 404 })

  // A stale version must not render: it would poison the CDN with an image
  // that no longer matches the card. Two halves to it — what the owner last
  // changed, and which generation of our own artwork drew the marks.
  const [ownerVersion, artVersion] = designVersion.split('-')
  if (Number(ownerVersion) !== program.design_version
      || artVersion !== String(ART_VERSION)) {
    return new Response('Stale design version', { status: 404 })
  }
  if (count > program.stamps_required) {
    return new Response('Count exceeds card size', { status: 400 })
  }

  const dimensions = size === 'hero' ? GOOGLE_HERO : APPLE_STRIP

  // Only the photo mode needs an image, and only then is it worth a lookup.
  let photo: Buffer | undefined
  if (program.card_style === 'photo' && program.photo_url) {
    const id = program.photo_url.split('/').pop()
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      const asset = await one<{ bytes: Buffer }>(
        `select bytes from assets where id = $1`, [id],
      )
      photo = asset?.bytes
    }
  }


  const png = await renderStrip({
    stamps: count,
    stampsRequired: program.stamps_required,
    rewardInGrid: program.reward_in_grid,
    state: state as CardState,
    style: program.card_style as CardStyle,
    photo,
    icon: program.stamp_icon as StampIcon,
    bgColor: program.bg_color,
    fgColor: program.fg_color,
    labelColor: program.label_color,
    rewardText: program.reward_text,
    width: dimensions.width,
    height: dimensions.height,
    scale,
  })

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
