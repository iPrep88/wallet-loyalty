/**
 * Pulling a usable image out of a .ico file.
 *
 * Image libraries will not read ICO, so the easy thing is to skip it — but a
 * small shop's website very often has nothing else. A corner café has a
 * favicon.ico and no apple-touch-icon, and those are precisely the businesses
 * this product is for.
 *
 * An ICO is a container: a short directory, then one image per entry. Since
 * about 2010 those entries are usually PNGs, which can be lifted out whole.
 * Older ones hold headerless BMPs, which are not worth decoding by hand —
 * those we still decline.
 */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

export function extractIcoPng(ico: Buffer): Buffer | null {
  if (ico.length < 22) return null
  if (ico.readUInt16LE(0) !== 0) return null          // reserved, must be zero
  if (ico.readUInt16LE(2) !== 1) return null          // 1 = icon (2 would be a cursor)

  const count = ico.readUInt16LE(4)
  if (count < 1 || count > 64) return null

  let best: { size: number; offset: number; length: number } | null = null

  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16
    if (entry + 16 > ico.length) break

    // A zero in the width byte means 256 — the format has one byte for it.
    const width = ico[entry] === 0 ? 256 : ico[entry]!
    const height = ico[entry + 1] === 0 ? 256 : ico[entry + 1]!
    const length = ico.readUInt32LE(entry + 8)
    const offset = ico.readUInt32LE(entry + 12)

    if (offset + length > ico.length || length < 8) continue
    if (!ico.subarray(offset, offset + 4).equals(PNG_MAGIC)) continue

    const size = Math.min(width, height)
    if (!best || size > best.size) best = { size, offset, length }
  }

  // Below 32px there is nothing worth building a card around.
  if (!best || best.size < 32) return null
  return ico.subarray(best.offset, best.offset + best.length)
}
