import sharp from 'sharp'
import { trimLogo } from '@wl/passes/logo'

/**
 * Taking an image from a shop owner.
 *
 * The limit belongs on what we KEEP, not on what they hand us. A photo
 * straight off a phone is 3–6MB and a logo exported from a design tool can be
 * larger still; refusing those and telling a café owner to "use a smaller
 * image" is asking them to go and learn image editing before they can have a
 * loyalty card. So: accept something generous, then make it small ourselves.
 *
 * Format follows content. A logo is flat colour and may be transparent, so it
 * stays PNG with a reduced palette, which for a wordmark is a few kilobytes.
 * A photograph as PNG is enormous for no benefit — nobody needs a
 * pixel-perfect record of a croissant — so it becomes JPEG.
 *
 * None of this touches what Apple receives. The pass never carries the
 * original: it gets artwork we render at the pass's own dimensions, which is
 * a handful of kilobytes whatever was uploaded.
 */

/** Generous: a modern phone photo, not a RAW file. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/** A guard against decompression bombs — a small file claiming vast dimensions. */
const MAX_INPUT_PIXELS = 60_000_000

/** What we are willing to keep in the database per image. */
const MAX_STORED_BYTES = 8 * 1024 * 1024

export interface Processed {
  bytes: Buffer
  mime: 'image/png' | 'image/jpeg'
  width: number
  height: number
}

export type ProcessResult =
  | { ok: true; image: Processed }
  | { ok: false; message: string }

export async function processUpload(
  original: Buffer,
  kind: 'logo' | 'photo',
): Promise<ProcessResult> {
  if (original.byteLength > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `That image is over ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. `
             + 'Try one straight from your phone rather than a print file.',
    }
  }

  try {
    // A logo exported with a wide margin arrives as a small mark adrift in a
    // big transparent box; trimming first means it lands on the card looking
    // deliberate rather than misaligned.
    // An SVG is vector and has no native resolution — the width in its header
    // is a default, not a limit. Rasterising at that default and then refusing
    // to enlarge produced a 16-pixel logo from a perfectly good vector mark,
    // which is what made a real shop's card look broken. Render it large
    // instead, by raising the density until it is.
    const probe = await sharp(original).metadata().catch(() => null)
    const target = kind === 'photo' ? 1600 : 960
    const density = probe?.format === 'svg'
      ? Math.min(2400, Math.max(72, Math.round(
          72 * (target / Math.max(1, Math.min(probe.width ?? 1, probe.height ?? 1))))))
      : undefined

    const raster = density
      ? await sharp(original, { density }).png().toBuffer()
      : original

    const source = kind === 'logo' ? await trimLogo(raster) : raster

    const pipeline = sharp(source, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()   // honour the phone's orientation tag before we discard it
      .resize(
        kind === 'photo'
          ? { width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }
          : { width: 960, height: 960, fit: 'inside', withoutEnlargement: true },
      )

    const { data, info } = kind === 'photo'
      ? await pipeline
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer({ resolveWithObject: true })
      : await pipeline
          // Flat artwork quantises to a tiny file; a photographic logo keeps
          // enough colours to still look like itself.
          .png({ compressionLevel: 9, palette: true, quality: 90 })
          .toBuffer({ resolveWithObject: true })

    if (data.byteLength > MAX_STORED_BYTES) {
      return {
        ok: false,
        message: 'That image could not be made small enough. Try a simpler one.',
      }
    }

    return {
      ok: true,
      image: {
        bytes: data,
        mime: kind === 'photo' ? 'image/jpeg' : 'image/png',
        width: info.width,
        height: info.height,
      },
    }
  } catch {
    return {
      ok: false,
      message: 'That file could not be read as an image. PNG, JPEG and WebP all work.',
    }
  }
}
