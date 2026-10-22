import { BRAND } from './_brand'

/**
 * Pieces the marketing page is built from.
 *
 * The phone frames and the dashboard are drawn in markup rather than dropped
 * in as screenshots. Two reasons: a screenshot goes stale the moment the
 * product moves, and a device frame rendered as an image is soft on exactly
 * the displays this page is trying to impress.
 */

/** An iPhone, holding whatever is given to it. */
export function Phone(
  { children, className = '', style }:
  { children: React.ReactNode; className?: string; style?: React.CSSProperties },
) {
  return (
    <div
      className={`relative rounded-[2.1rem] p-[3px] ${className}`}
      style={{
        background: 'linear-gradient(160deg, #46525E 0%, #19222C 42%, #39454F 100%)',
        boxShadow: '0 40px 80px -30px rgba(0,0,0,.75), 0 2px 6px rgba(255,255,255,.08) inset',
        ...style,
      }}
    >
      <div className="relative overflow-hidden rounded-[1.95rem]"
           style={{ background: BRAND.midnight }}>
        {/* The notch, which is what makes a rounded rectangle read as a phone. */}
        <div className="absolute left-1/2 top-[7px] z-10 h-[18px] w-[78px] -translate-x-1/2
                        rounded-full" style={{ background: '#05090E' }} />
        {children}
      </div>
    </div>
  )
}

export function StatusBar({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const ink = tone === 'light' ? 'rgba(255,255,255,.92)' : 'rgba(10,20,32,.85)'
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[11px] font-semibold"
         style={{ color: ink }}>
      <span>9:41</span>
      <span className="flex items-center gap-1" aria-hidden>
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 4} y={6 - i * 2} width="2.5" height={4 + i * 2}
                  rx="0.6" fill={ink} opacity={i === 3 ? 0.4 : 1} />
          ))}
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
          <rect x="0.6" y="0.6" width="17.5" height="9.8" rx="2.6"
                stroke={ink} strokeOpacity="0.45" />
          <rect x="2" y="2" width="12.5" height="7" rx="1.5" fill={ink} />
          <path d="M19.6 3.6v3.8c1-.3 1.4-.9 1.4-1.9s-.4-1.6-1.4-1.9z" fill={ink} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

/**
 * A wallet card. The band is real artwork from the renderer; everything else
 * is set in markup, the way the operating system sets it on a real pass.
 */
export function WalletCard({
  name, tagline, art, bg, fg, muted, stamps, required, caption, reward,
}: {
  name: string
  tagline?: string
  art: string
  bg: string
  fg: string
  muted: string
  stamps: number
  required: number
  caption?: string
  reward?: string
}) {
  return (
    <div className="overflow-hidden rounded-[18px]"
         style={{ background: bg, color: fg, boxShadow: '0 18px 40px -22px rgba(0,0,0,.55)' }}>
      <div className="px-4 pt-4 pb-3 text-center">
        <div className="text-[15px] font-bold tracking-[0.22em]">{name}</div>
        {tagline && (
          <div className="mt-1 text-[8.5px] font-semibold tracking-[0.2em]"
               style={{ color: muted }}>{tagline}</div>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art} alt="" width={375} height={98} className="block w-full"
           style={{ aspectRatio: '375 / 98' }} />
      <div className="px-4 pb-4 pt-3">
        <div className="text-[17px] font-bold tabular">{stamps} / {required}</div>
        {caption && (
          <div className="mt-0.5 text-[11px] leading-snug" style={{ color: muted }}>{caption}</div>
        )}
        {reward && (
          <>
            <div className="mt-2.5 text-[8.5px] font-bold uppercase tracking-[0.16em]"
                 style={{ color: muted }}>Next reward</div>
            <div className="text-[12.5px] font-semibold">{reward}</div>
          </>
        )}
      </div>
    </div>
  )
}

/** A QR, drawn as a deterministic grid — no library, no network, always crisp. */
export function FakeQr({ size = 96, dark = '#0B1B2B', light = '#FFFFFF', seed = 7 }: {
  size?: number; dark?: string; light?: string; seed?: number
}) {
  const N = 21
  const cell = size / N
  const on = (x: number, y: number) => {
    // Finder squares in three corners, as a real code has.
    const finder = (fx: number, fy: number) =>
      x >= fx && x < fx + 7 && y >= fy && y < fy + 7 &&
      (x === fx || x === fx + 6 || y === fy || y === fy + 6 ||
       (x >= fx + 2 && x <= fx + 4 && y >= fy + 2 && y <= fy + 4))
    if (finder(0, 0) || finder(N - 7, 0) || finder(0, N - 7)) return true
    if ((x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9)) return false
    return ((x * 73 + y * 151 + seed * 31) % 7) < 3
  }
  const rects: React.ReactElement[] = []
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (on(x, y)) {
        rects.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell}
                         width={cell} height={cell} fill={dark} />)
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <rect width={size} height={size} fill={light} />
      {rects}
    </svg>
  )
}

export function AddToWallet({ kind }: { kind: 'apple' | 'google' }) {
  const apple = kind === 'apple'
  return (
    <div className="inline-flex items-center gap-2 rounded-[7px] px-3 py-1.5"
         style={{ background: apple ? '#000' : '#fff',
                  border: apple ? 'none' : '1px solid #DADCE0' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="3"
              fill={apple ? '#fff' : '#4285F4'} opacity={apple ? 0.95 : 1} />
        <rect x="2" y="9" width="20" height="2.5" fill={apple ? '#000' : '#fff'} />
      </svg>
      <span className="text-left leading-none">
        <span className="block text-[6.5px] font-medium"
              style={{ color: apple ? 'rgba(255,255,255,.7)' : '#5F6368' }}>Add to</span>
        <span className="block text-[10px] font-semibold"
              style={{ color: apple ? '#fff' : '#3C4043' }}>
          {apple ? 'Apple Wallet' : 'Google Wallet'}
        </span>
      </span>
    </div>
  )
}

/**
 * Stands in for a photograph that has not been taken yet.
 *
 * Marked in the DOM so every one of them can be found and swapped, and shaped
 * so the layout around it is already correct at the right aspect ratio.
 */
export function PhotoSlot(
  { label, className = '', children }:
  { label: string; className?: string; children?: React.ReactNode },
) {
  return (
    <div data-photo-slot={label}
         className={`relative overflow-hidden ${className}`}
         style={{
           background:
             `linear-gradient(145deg, ${BRAND.navy} 0%, ${BRAND.deepNavy} 55%, #1B3A55 100%)`,
         }}>
      <div className="absolute inset-0 opacity-[0.07]"
           style={{ backgroundImage:
             'radial-gradient(circle at 25% 30%, #fff 0 2px, transparent 2px)',
             backgroundSize: '26px 26px' }} />
      {children}
    </div>
  )
}
