import { one } from '@wl/db'

/**
 * Serves an uploaded image.
 *
 * Public and immutable: the id is a random uuid, the bytes behind it never
 * change, and a replaced logo gets a new id rather than overwriting this one.
 * So it can be cached forever, and a card's artwork never has to wonder
 * whether its logo moved.
 */
export const dynamic = 'force-static'
export const revalidate = false

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 })

  const asset = await one<{ mime: string; bytes: Buffer }>(
    `select mime, bytes from assets where id = $1`, [id],
  )
  if (!asset) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      'Content-Type': asset.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
