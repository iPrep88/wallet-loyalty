import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Fetching a URL that somebody else typed.
 *
 * This is the only place in the product where a stranger chooses an address
 * our server then requests, and that server also runs iPrep with a database
 * listening on localhost. Without a guard, "paste your website" is an
 * invitation to make our machine fetch its own internals — a cloud metadata
 * endpoint, an admin panel on a private address, a database port — and hand
 * the result back in a card preview.
 *
 * So: only http(s), every hop resolved and checked against the private
 * ranges before the request is made, redirects followed by hand rather than
 * by fetch (which would resolve the next hop without asking us), a timeout,
 * and a size cap.
 */

const MAX_REDIRECTS = 4
// Small business sites are often slow — a shared host waking up, a page of
// unoptimised images. Six seconds failed sites that would have answered.
const TIMEOUT_MS = 12000
const MAX_BYTES = 3 * 1024 * 1024

export type SafeFetchError =
  | 'bad_url' | 'blocked_host' | 'unreachable' | 'too_big' | 'timeout' | 'bad_status'

export type SafeFetchResult =
  | { ok: true; url: string; contentType: string; body: Buffer }
  | { ok: false; error: SafeFetchError; message: string }

/** Private, loopback, link-local and other ranges nobody's website lives on. */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip)
  if (version === 0) return true

  if (version === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::' || lower === '::1') return true
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return true
    // An IPv4 address wearing an IPv6 costume still goes where it says.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped?.[1]) return isBlockedAddress(mapped[1])
    return false
  }

  const parts = ip.split('.').map(Number)
  const [a, b] = parts as [number, number, number, number]
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true           // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true             // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
  if (a >= 224) return true                         // multicast and reserved
  return false
}

/** Every address a hostname resolves to must be allowed, not just the first. */
async function hostIsAllowed(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return !isBlockedAddress(hostname)
  try {
    const records = await lookup(hostname, { all: true })
    return records.length > 0 && records.every((r) => !isBlockedAddress(r.address))
  } catch {
    return false
  }
}

export function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null   // "localhost", "db", a container name
    return url
  } catch {
    return null
  }
}

export async function safeFetch(rawUrl: string | URL): Promise<SafeFetchResult> {
  let url = typeof rawUrl === 'string' ? normalizeUrl(rawUrl) : rawUrl
  if (!url) return { ok: false, error: 'bad_url', message: 'That does not look like a web address.' }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await hostIsAllowed(url.hostname))) {
      return {
        ok: false, error: 'blocked_host',
        // Say what happened rather than "could not be reached". The honest
        // case is an owner whose own domain resolves to this machine — our
        // server's /etc/hosts points iprep.ca at 127.0.0.1, so from here that
        // address genuinely is localhost. Telling them "unreachable" sends
        // them to check a website that is plainly working.
        message: 'That address points at a private network from our server, '
               + 'so there is nothing there for us to read.',
      }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(url.toString(), {
        // Handled by hand, so the next hop is checked before it is requested.
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Identifies itself, but as a browser-shaped client: a bare bot
          // string is refused outright by a lot of small-business hosting
          // and by the firewalls sitting in front of it.
          'User-Agent':
            'Mozilla/5.0 (compatible; VizisBrandBot/1.0; +https://loyalty.iprep.ca)',
          Accept: 'text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.5',
          'Accept-Language': 'en-CA,en;q=0.9',
        },
      })
    } catch (e) {
      clearTimeout(timer)
      const aborted = e instanceof Error && e.name === 'AbortError'
      return {
        ok: false,
        error: aborted ? 'timeout' : 'unreachable',
        message: aborted ? 'That site took too long to answer.' : 'That site could not be reached.',
      }
    }
    clearTimeout(timer)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) break
      try {
        url = new URL(location, url)
      } catch {
        return { ok: false, error: 'bad_url', message: 'That site redirected somewhere unusable.' }
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return { ok: false, error: 'blocked_host', message: 'That address could not be reached.' }
      }
      continue
    }

    if (!res.ok) {
      return { ok: false, error: 'bad_status', message: `That site answered with ${res.status}.` }
    }

    const declared = Number(res.headers.get('content-length') ?? '0')
    if (declared > MAX_BYTES) {
      return { ok: false, error: 'too_big', message: 'That page is too large to read.' }
    }

    const body = Buffer.from(await res.arrayBuffer())
    if (body.byteLength > MAX_BYTES) {
      return { ok: false, error: 'too_big', message: 'That page is too large to read.' }
    }

    return {
      ok: true,
      url: url.toString(),
      contentType: res.headers.get('content-type') ?? '',
      body,
    }
  }

  return { ok: false, error: 'bad_url', message: 'That site redirected too many times.' }
}
