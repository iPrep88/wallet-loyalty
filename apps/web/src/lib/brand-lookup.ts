import { analyzeLogo } from '@wl/passes/logo'
import { contrastRatio, ensureReadable, luminance, paletteFromAnalysis } from '@wl/passes/colors'
import type { Palette } from '@wl/passes/colors'
import sharp from 'sharp'
import { safeFetch, normalizeUrl } from './safe-fetch'
import { extractIcoPng } from './ico'

/**
 * Turning a web address into a finished card.
 *
 * The premise of the product is "give us your logo and we handle the rest".
 * This goes one better: give us your address and we will find the logo
 * ourselves. What comes back is three complete cards to choose between, not
 * a set of controls to operate.
 */

export interface BrandOption {
  id: 'brand' | 'dark' | 'light' | 'photo'
  name: string
  blurb: string
  style: 'minimal' | 'photo'
  palette: Palette
}

export interface BrandLookup {
  siteUrl: string
  /** The business name as the site states it, when it states one. */
  name: string | null
  /** PNG bytes of the best logo found. */
  logo: Buffer | null
  /** A photograph the site uses to represent itself, if any. */
  photo: Buffer | null
  options: BrandOption[]
  /** False when nothing brand-specific was found and these are house colours. */
  foundBrand: boolean
}

export type LookupResult =
  | { ok: true; data: BrandLookup }
  | { ok: false; message: string }

export async function lookupBrand(input: string): Promise<LookupResult> {
  const url = normalizeUrl(input)
  if (!url) return { ok: false, message: 'That does not look like a web address.' }

  let page = await safeFetch(url)

  // Plenty of small businesses answer on only one of apex or www, and the
  // owner has no idea which — they just know their address. Try the other.
  if (!page.ok && (page.error === 'unreachable' || page.error === 'bad_status')) {
    const swapped = new URL(url.toString())
    swapped.hostname = url.hostname.startsWith('www.')
      ? url.hostname.slice(4)
      : `www.${url.hostname}`
    const second = await safeFetch(swapped)
    if (second.ok) page = second
  }

  if (!page.ok) {
    return {
      ok: false,
      message: `${page.message} You can skip this and upload your logo instead.`,
    }
  }
  if (!page.contentType.includes('html')) {
    return { ok: false, message: 'That address is not a web page.' }
  }

  const html = page.body.toString('utf8').slice(0, 400_000)
  const base = new URL(page.url)

  const name = extractName(html)
  const themeColor = extractThemeColor(html)

  // A square icon is a logo; og:image is usually a hero photograph. Treating
  // the two as the same thing is how you end up pasting a croissant where a
  // wordmark should be.
  // A logo has to be big enough to be one. A photograph does not — og:image
  // is a hero shot and is always large enough.
  const logo = await bestImage(iconCandidates(html, base), true)
  const photo = await bestImage(photoCandidates(html, base), false)

  const options = await buildOptions(logo, themeColor, Boolean(photo))

  return {
    ok: true,
    data: {
      siteUrl: base.origin, name, logo, photo, options,
      // Whether any of this came from their site, or whether we are showing
      // house colours. Presenting a default as "your colours" is a small lie
      // the owner notices immediately.
      foundBrand: Boolean(logo) || Boolean(themeColor),
    },
  }
}

/* ----------------------------------------------------------- extraction */
function attr(html: string, pattern: RegExp): string | null {
  const m = pattern.exec(html)
  return m?.[1]?.trim() || null
}

/**
 * Reads one attribute, respecting the quote that opened it.
 *
 * `[^"']+` looks right and is wrong: an inline SVG favicon is wrapped in
 * double quotes and full of single ones, so a naive capture returns the first
 * thirty characters of a two-thousand character image. Match to the same
 * quote that opened the value, not to whichever appears first.
 */
function quotedAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}=(["'])((?:(?!\\1)[\\s\\S])*)\\1`, 'i')
  const m = re.exec(tag)
  return m?.[2]?.trim() || null
}

function extractName(html: string): string | null {
  const og = attr(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)
  if (og) return clean(og)
  const app = attr(html, /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)/i)
  if (app) return clean(app)
  const title = attr(html, /<title[^>]*>([^<]+)</i)
  if (!title) return null
  // Titles are usually "Name | Tagline" or "Name - Home".
  return clean(title.split(/\s[|–—-]\s/)[0] ?? title)
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 60)
}

function extractThemeColor(html: string): string | null {
  const c = attr(html, /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)/i)
  return c && /^#[0-9a-f]{3,8}$/i.test(c) ? c.slice(0, 7).toUpperCase() : null
}

/** Square marks, best first. */
function iconCandidates(html: string, base: URL): string[] {
  const out: string[] = []
  // Not /<link[^>]+>/ : an inline SVG favicon puts '>' inside the href, and a
  // naive match chops the tag in half and loses the image. This allows '>'
  // when it sits inside a quoted value, which is where HTML permits it.
  const linkTags = html.match(/<link(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? []

  const withRel = (rel: RegExp) => linkTags
    .filter((t) => rel.test(t))
    .map((t) => ({
      href: quotedAttr(t, 'href'),
      size: Number(/\bsizes=["'](\d+)/i.exec(t)?.[1] ?? 0),
    }))
    .filter((x): x is { href: string; size: number } => Boolean(x.href))
    // Bigger is better: a 180px touch icon beats a 16px favicon every time.
    .sort((a, b) => b.size - a.size)
    .map((x) => x.href)

  // Everything, in no particular order — the choice is made by measuring the
  // images, not by reading what the page claims about them.
  out.push(...withRel(/rel=["'][^"']*apple-touch-icon/i))
  out.push(...withRel(/rel=["'][^"']*\bicon\b/i))
  out.push('/favicon.ico')

  return out.map((href) => absolute(href, base)).filter(Boolean) as string[]
}

function photoCandidates(html: string, base: URL): string[] {
  const og = attr(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
  const tw = attr(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)
  return [og, tw].filter(Boolean).map((h) => absolute(h!, base)).filter(Boolean) as string[]
}

function absolute(href: string, base: URL): string | null {
  // A data: URL is already the image — it needs resolving against nothing.
  if (href.startsWith('data:')) return href
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

/**
 * Decodes an inline image.
 *
 * Increasingly a site's only icon is a `data:image/svg+xml,...` in the head,
 * with no file anywhere to fetch. That is not an edge case to skip — an SVG
 * is vector, so it is the best logo source there is, better than any bitmap
 * favicon.
 */
function decodeDataUrl(url: string): { bytes: Buffer; type: string } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url)
  if (!m) return null
  const type = m[1] ?? ''
  const isBase64 = Boolean(m[2])
  const payload = m[3] ?? ''
  if (!type.startsWith('image/')) return null
  try {
    const bytes = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8')
    return bytes.byteLength >= 40 ? { bytes, type } : null
  } catch {
    return null
  }
}

/**
 * Below this, an icon is not a logo — it is a browser tab decoration, and
 * stretching it across a card looks exactly like what it is.
 */
const MIN_LOGO_PIXELS = 64

/**
 * The best image among the candidates, measured rather than taken on trust.
 *
 * A page's `sizes` attribute is a claim, not a fact. The Union Hotel's site
 * declares a 32x32, a 192x192, and an apple-touch-icon with no size at all —
 * and that last one, which this used to prefer categorically, is 16 pixels
 * across. Blown up to fill a card it was unusable, which is precisely what
 * Ben saw.
 *
 * So: fetch the candidates, ask each image how big it actually is, take the
 * largest, and if the best of them is still tiny, report no logo rather than
 * hand back something blurry.
 */
async function bestImage(urls: string[], requireSize: boolean): Promise<Buffer | null> {
  let best: { pixels: number; bytes: Buffer } | null = null

  for (const u of urls.slice(0, 5)) {
    const bytes = await fetchImage(u)
    if (!bytes) continue

    let pixels = 0
    try {
      const meta = await sharp(bytes).metadata()
      pixels = Math.min(meta.width ?? 0, meta.height ?? 0)
      // An SVG has no intrinsic size worth comparing — it is vector, so it is
      // always the best candidate available.
      if (meta.format === 'svg') pixels = 4096
    } catch {
      continue
    }

    if (!best || pixels > best.pixels) best = { pixels, bytes }
  }

  if (!best) return null
  if (requireSize && best.pixels < MIN_LOGO_PIXELS) return null
  return best.bytes
}

/** One candidate, fetched and unwrapped. */
async function fetchImage(u: string): Promise<Buffer | null> {
  {
    if (u.startsWith('data:')) {
      return decodeDataUrl(u)?.bytes ?? null
    }

    const res = await safeFetch(u)
    if (!res.ok) return null
    if (!res.contentType.startsWith('image/')) return null
    if (res.body.byteLength < 200) return null   // a tracking pixel or an error page

    // A .ico is a container no image library will open, but a small shop's
    // site often has nothing else — so look inside for the PNG.
    if (res.contentType.includes('icon') || /\.ico(\?|$)/i.test(u)) {
      return extractIcoPng(res.body)
    }
    return res.body
  }
}

/* -------------------------------------------------------------- options */
const DARK_GROUND = '#101620'
const LIGHT_GROUND = '#FAFAF8'

/**
 * Three finished cards, all built from the same brand colour.
 *
 * Not three random templates: the point is that each is recognisably theirs,
 * so the choice is a matter of taste rather than a gamble.
 */
async function buildOptions(
  logo: Buffer | null,
  themeColor: string | null,
  hasPhoto: boolean,
): Promise<BrandOption[]> {
  const HOUSE_INK = '#2F6FA8'
  let ink = themeColor ?? HOUSE_INK
  let fromLogo: Palette | null = null

  if (logo) {
    try {
      const analysis = await analyzeLogo(logo)
      ink = themeColor ?? analysis.ink
      fromLogo = paletteFromAnalysis(analysis)
    } catch {
      // An unreadable image is not a reason to fail the whole lookup.
    }
  }

  const options: BrandOption[] = []

  if (fromLogo) {
    options.push({
      id: 'brand', name: 'Your colours', style: 'minimal',
      blurb: 'Taken from your logo.', palette: fromLogo,
    })
  }

  options.push({
    id: 'dark', name: 'Midnight', style: 'minimal',
    blurb: themeColor || logo
      ? 'Your brand colour on near-black. Usually the most expensive-looking.'
      : 'Near-black and quiet. Add your logo and we will recolour it.',
    palette: ensureReadable({
      bg: DARK_GROUND,
      // A dark brand colour disappears on a dark ground, so the mark falls
      // back to something that will actually be seen.
      fg: contrastRatio(DARK_GROUND, ink) >= 3 ? ink : '#F2F5F9',
      label: '#8A97A8',
    }),
  })

  options.push({
    id: 'light', name: 'Porcelain', style: 'minimal',
    blurb: themeColor || logo
      ? 'Your brand colour on off-white. Clean and quiet.'
      : 'Off-white and simple. Add your logo and we will recolour it.',
    palette: ensureReadable({
      bg: LIGHT_GROUND,
      fg: contrastRatio(LIGHT_GROUND, ink) >= 3 ? ink : '#15181C',
      label: '#6B7280',
    }),
  })

  if (hasPhoto) {
    // Their own picture behind the stamps, with the brand colour carried
    // through on the rest of the card.
    const base = fromLogo ?? {
      bg: luminance(ink) < 0.45 ? LIGHT_GROUND : DARK_GROUND,
      fg: ink,
      label: '#6B7280',
    }
    options.push({
      id: 'photo', name: 'Photo', style: 'photo',
      blurb: 'The picture from your website, cropped and shaded for you.',
      palette: ensureReadable(base),
    })
  }

  return options
}
