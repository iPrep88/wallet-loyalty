'use client'

import { useEffect, useState } from 'react'

/**
 * Putting the scanner on the counter phone's home screen.
 *
 * Three different jobs wearing one name, which is why this is not a single
 * set of instructions with arrows:
 *
 *   Android can genuinely install. The browser fires beforeinstallprompt and
 *   we can show one button that does it. Step-by-step arrows there would be
 *   worse than the thing the platform already offers.
 *
 *   iOS has no API at all, so instructions are the only option — and they
 *   have to name the Share icon, because "the square with the arrow" is the
 *   one step people get stuck on.
 *
 *   An in-app browser (a link opened inside Instagram or Messenger) cannot
 *   add anything to a home screen at all. Telling someone to tap a Share
 *   button that will not work is worse than telling them to open Safari.
 *
 * And once it IS installed, none of this should ever appear again.
 */

type Platform = 'android' | 'ios-safari' | 'ios-inapp' | 'desktop' | 'installed' | 'unknown'

interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [deferred, setDeferred] = useState<InstallEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Already on the home screen: standalone on Android, a vendor flag on iOS.
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as { standalone?: boolean }).standalone === true
    if (standalone) { setPlatform('installed'); return }

    try {
      if (localStorage.getItem('repio.install.dismissed') === '1') setDismissed(true)
    } catch { /* private mode */ }

    const ua = navigator.userAgent
    const isIos = /iPhone|iPad|iPod/.test(ua)
      || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)

    if (isIos) {
      // Instagram, Facebook, Messenger and the rest render links in their own
      // browser, which has no Add to Home Screen.
      const inApp = /FBAN|FBAV|Instagram|Line|Twitter|LinkedInApp|Snapchat/.test(ua)
      setPlatform(inApp ? 'ios-inapp' : 'ios-safari')
      return
    }
    if (/Android/.test(ua)) { setPlatform('android'); return }
    setPlatform('desktop')
  }, [])

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function hide() {
    setDismissed(true)
    try { localStorage.setItem('repio.install.dismissed', '1') } catch { /* private mode */ }
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === 'accepted') setPlatform('installed')
  }

  if (platform === 'installed' || platform === 'unknown' || dismissed) return null

  return (
    <div className="mb-5 rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={44} height={44}
             className="size-11 flex-none rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold leading-snug">
            Put this on the home screen
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
            It opens full screen, with no address bar — like any other app on
            this phone.
          </p>
        </div>
        <button onClick={hide} aria-label="Not now"
          className="-mr-1 -mt-1 flex-none rounded-lg p-1.5 text-faint hover:text-ink">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-3.5">
        {platform === 'android' && (
          deferred ? (
            <button onClick={() => void install()}
              className="w-full rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold
                         text-accent-ink">
              Install
            </button>
          ) : (
            <Steps items={[
              <>Tap the <strong>⋮</strong> menu, top right.</>,
              <>Choose <strong>Install app</strong>, or <strong>Add to Home
                screen</strong>.</>,
            ]} />
          )
        )}

        {platform === 'ios-safari' && (
          <Steps items={[
            <>Tap <ShareIcon /> <strong>Share</strong> at the bottom of the screen.</>,
            <>Scroll down and tap <strong>Add to Home Screen</strong>.</>,
            <>Tap <strong>Add</strong>. The Repio icon appears with your other apps.</>,
          ]} />
        )}

        {platform === 'ios-inapp' && (
          <p className="text-[13px] leading-snug text-muted">
            You opened this inside another app, which cannot add things to the
            home screen. Tap the <strong>…</strong> menu and choose{' '}
            <strong>Open in Safari</strong> first, then come back here.
          </p>
        )}

        {platform === 'desktop' && (
          <p className="text-[13px] leading-snug text-muted">
            This works best on the phone or tablet that lives at your counter.
            Open <strong>tryrepio.com/scan</strong> there and you can add it to
            the home screen.
          </p>
        )}
      </div>
    </div>
  )
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug">
          <span className="flex size-5 flex-none items-center justify-center rounded-full
                           bg-accent text-[11px] font-bold tabular text-accent-ink">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

/** iOS's share glyph. Drawn, because the step everyone gets stuck on is
 *  finding this exact shape — describing it in words does not work. */
function ShareIcon() {
  return (
    <svg viewBox="0 0 20 20" className="inline-block size-[15px] -translate-y-px"
         fill="none" aria-hidden>
      <path d="M10 2.5v10M10 2.5 7 5.5M10 2.5l3 3" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 8.5h-1v9h11v-9h-1" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
