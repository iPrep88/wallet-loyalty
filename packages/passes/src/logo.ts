import sharp from 'sharp'

/**
 * What a logo actually is, before deciding what to build around it.
 *
 * The distinction that matters: a logo with transparency carries only its own
 * ink, so the card has to supply a background that ink can be seen against.
 * A logo without transparency brings its own background — almost always white
 * — and the card has to blend with that, or the logo lands as a pasted square.
 *
 * Getting this backwards is how you end up with a blue logo on a blue card.
 */
export interface LogoAnalysis {
  /** True when a meaningful share of pixels are see-through. */
  hasTransparency: boolean
  /** The logo's dominant visible colour — its ink. */
  ink: string
  /** The logo's own background, when it has one and it is uniform. */
  backdrop: string | null
  /** Whether that ink is dark against white. */
  inkIsDark: boolean
}

export async function analyzeLogo(input: Buffer): Promise<LogoAnalysis> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .resize({ width: 160, height: 160, fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels
  const px = info.width * info.height

  // Histogram of visible colours, coarsened so near-identical shades group.
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  let transparent = 0

  for (let i = 0; i < px; i++) {
    const o = i * channels
    const a = data[o + 3] ?? 255
    if (a < 128) { transparent++; continue }
    const r = data[o] ?? 0, g = data[o + 1] ?? 0, b = data[o + 2] ?? 0
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b
    buckets.set(key, bucket)
  }

  const hasTransparency = transparent / px > 0.15

  // The corners tell us whether there is a backdrop, and what it is.
  const corner = (x: number, y: number) => {
    const o = (y * info.width + x) * channels
    return { r: data[o] ?? 0, g: data[o + 1] ?? 0, b: data[o + 2] ?? 0, a: data[o + 3] ?? 255 }
  }
  const corners = [
    corner(1, 1), corner(info.width - 2, 1),
    corner(1, info.height - 2), corner(info.width - 2, info.height - 2),
  ]
  const opaqueCorners = corners.filter((c) => c.a >= 128)
  const uniform = opaqueCorners.length === 4 && opaqueCorners.every((c) =>
    Math.abs(c.r - opaqueCorners[0]!.r) < 12 &&
    Math.abs(c.g - opaqueCorners[0]!.g) < 12 &&
    Math.abs(c.b - opaqueCorners[0]!.b) < 12)
  const backdrop = uniform && opaqueCorners[0]
    ? hex(opaqueCorners[0].r, opaqueCorners[0].g, opaqueCorners[0].b)
    : null

  // Ink is the most prominent colour that is not the backdrop — a logo on
  // white is mostly white pixels, and white is not the brand.
  let best: { score: number; r: number; g: number; b: number } | null = null
  for (const b of buckets.values()) {
    const r = b.r / b.n, g = b.g / b.n, bl = b.b / b.n
    if (backdrop && near(hex(r, g, bl), backdrop, 28)) continue
    // Weight by how much there is of it and how much colour it carries, so a
    // large field of near-grey loses to a smaller block of real brand colour.
    const score = b.n * (1 + saturation(r, g, bl) * 2)
    if (!best || score > best.score) best = { score, r, g, b: bl }
  }

  const ink = best ? hex(best.r, best.g, best.b) : '#1F2933'
  return { hasTransparency, ink, backdrop, inkIsDark: luminance(ink) < 0.45 }
}

/** Crops uniform borders so a logo sits tight instead of inside dead space. */
export async function trimLogo(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).trim({ threshold: 12 }).png().toBuffer()
  } catch {
    return input  // an image that is entirely one colour cannot be trimmed
  }
}

// ---------------------------------------------------------------- helpers
function hex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

function near(a: string, b: string, tolerance: number): boolean {
  const pa = parse(a), pb = parse(b)
  return Math.abs(pa.r - pb.r) < tolerance
      && Math.abs(pa.g - pb.g) < tolerance
      && Math.abs(pa.b - pb.b) < tolerance
}

function parse(h: string) {
  const n = Number.parseInt(h.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function luminance(h: string): number {
  const { r, g, b } = parse(h)
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}
