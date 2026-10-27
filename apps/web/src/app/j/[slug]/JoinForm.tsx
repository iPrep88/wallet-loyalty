'use client'

import { useEffect, useState } from 'react'

type Platform = 'apple' | 'google' | 'desktop'

interface JoinResponse {
  ok: boolean
  message?: string
  existing?: boolean
  card_token?: string
  member?: { stamps: number; stamps_required: number; reward_text: string }
  wallet?: {
    apple_pkpass_url: string | null
    google_save_url: string | null
    pending: string[]
  }
}

export default function JoinForm(
  { slug, labelColor, fgColor }: { slug: string; labelColor: string; fgColor: string },
) {
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<JoinResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent
    // iPad reports as Macintosh; touch points are what give it away.
    const isIos = /iPhone|iPod/.test(ua)
      || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    setPlatform(isIos ? 'apple' : /Android/.test(ua) ? 'google' : 'desktop')
  }, [])

  async function join() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          phone: phone.trim() || undefined,
          platform: platform === 'desktop' ? undefined : platform,
          sms_consent: consent,
        }),
      })
      const data = (await res.json()) as JoinResponse
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Something went wrong. Please try again.')
        return
      }
      setResult(data)
    } catch {
      setError('No connection. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (result?.ok) {
    return (
      <div className="mt-8">
        <p className="text-center text-base font-medium">
          {result.existing ? 'Welcome back — that is your card.' : 'You are in.'}
        </p>

        {result.wallet?.google_save_url && (
          <a
            href={result.wallet.google_save_url}
            className="mt-5 flex h-[52px] w-full items-center justify-center gap-2.5
                       rounded-[26px] bg-black px-5 text-[15px] font-medium text-white
                       transition active:opacity-85"
          >
            <WalletGlyph />
            Add to Google Wallet
          </a>
        )}

        {result.wallet?.apple_pkpass_url && (
          <a
            href={result.wallet.apple_pkpass_url}
            className="mt-3 flex h-[52px] w-full items-center justify-center rounded-[26px]
                       bg-black px-5 text-[15px] font-medium text-white transition
                       active:opacity-85"
          >
            Add to Apple Wallet
          </a>
        )}

        {/* Only mention a wallet that is actually missing. Once one of them
            works, telling someone the OTHER one does not is noise they cannot
            act on — they have the card they came for. */}
        {result.wallet
          && result.wallet.pending.includes(platform === 'apple' ? 'apple' : 'google')
          && (
          <div className="mt-5 rounded-xl border border-current/20 p-4 text-[13px] leading-relaxed"
               style={{ color: labelColor }}>
            <p className="font-medium" style={{ color: fgColor }}>
              Wallet delivery is not switched on yet
            </p>
            <p className="mt-1">
              Your stamps are saved and your card works — adding it to{' '}
              {platform === 'apple' ? 'Apple Wallet' : 'Google Wallet'} needs the
              developer account set up first.
            </p>
          </div>
        )}

        {result.card_token && (
          <details className="mt-5 text-[12px]" style={{ color: labelColor }}>
            <summary className="cursor-pointer">Card token (for testing)</summary>
            <code className="mt-2 block break-all font-mono text-[11px] opacity-80">
              {result.card_token}
            </code>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="mt-8">
      <label className="block text-[13px]" style={{ color: labelColor }}>
        Phone number (optional)
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(416) 555-0199"
          className="mt-1.5 w-full rounded-xl border border-current/25 bg-white/10 px-4 py-3 text-base
                     placeholder:opacity-50 focus:border-current/60 focus:outline-none"
          style={{ color: fgColor }}
        />
        <span className="mt-1.5 block opacity-70">So you never lose your stamps.</span>
      </label>

      {/* CASL: express consent, captured at the moment it is given, or not at
          all. It cannot be granted retroactively. */}
      {phone.trim() !== '' && (
        <label className="mt-4 flex gap-2.5 text-[12px] leading-snug"
               style={{ color: labelColor }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-current"
          />
          <span>
            Text me occasional offers from this shop. Optional — you will get your
            card either way, and you can stop any time.
          </span>
        </label>
      )}

      <button
        onClick={join}
        disabled={busy}
        className="mt-6 w-full rounded-xl px-4 py-4 text-base font-semibold
                   transition disabled:opacity-60"
        style={{ backgroundColor: fgColor, color: 'var(--btn-fg, #000)' }}
      >
        {busy
          ? 'One moment…'
          : platform === 'apple'
            ? 'Add to Apple Wallet'
            : platform === 'google'
              ? 'Save to Google Wallet'
              : 'Get my card'}
      </button>

      {platform === 'desktop' && (
        <p className="mt-3 text-center text-[12px]" style={{ color: labelColor }}>
          Open this page on your phone to add the card to your wallet.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-black/20 px-3 py-2 text-center text-[13px]">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * A wallet glyph for the save button.
 *
 * Google's brand guidelines require their own "Add to Google Wallet" asset in
 * production, with its wordmark and exact proportions. This stands in until
 * the issuer account leaves demo mode, which is the same moment the button
 * starts being seen by anyone outside the allowlist.
 */
function WalletGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3"
            stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="14.5" r="1.4" fill="currentColor" />
    </svg>
  )
}
