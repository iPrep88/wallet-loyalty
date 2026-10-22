'use client'

/**
 * A small preview of one generated card, for choosing between.
 *
 * Drawn in markup rather than fetched from the renderer: these options are
 * not saved yet, so there is nothing for the artwork endpoint to render —
 * and three server round trips to decide between three swatches would make
 * the moment feel slow exactly where it should feel instant. The real
 * renderer draws the card the moment one is chosen.
 */
export default function OptionCard({
  name, blurb, bg, fg, label, shopName, photoUrl, isPhoto, selected, onSelect,
}: {
  name: string
  blurb: string
  bg: string
  fg: string
  label: string
  shopName: string
  photoUrl?: string | null
  isPhoto?: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button onClick={onSelect}
      className={`w-full rounded-2xl border p-2.5 text-left transition-colors ${
        selected ? 'border-accent bg-accent-soft' : 'border-line hover:border-faint'}`}>
      <span className="block overflow-hidden rounded-xl" style={{ background: bg, color: fg }}>
        <span className="flex items-center justify-between px-3 pt-2.5 pb-2">
          <span className="truncate text-[11px] font-bold tracking-[0.12em]">
            {(shopName || 'Your shop').toUpperCase()}
          </span>
          <span className="flex-none text-[10px] font-bold tabular">3 / 10</span>
        </span>

        {/* The stamp row, in the same proportions the renderer uses. */}
        <span className="relative block" style={{ aspectRatio: '375 / 98' }}>
          {isPhoto && photoUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
              <span className="absolute inset-0"
                    style={{ background: 'linear-gradient(0deg, rgba(5,7,10,.58), rgba(5,7,10,.3))' }} />
            </>
          )}
          <span className="absolute inset-0 flex items-center justify-between px-[5%]">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i}
                className="block rounded-full"
                style={{
                  width: '7%', aspectRatio: '1',
                  background: i < 3 ? (isPhoto ? '#FFFFFF' : fg) : 'transparent',
                  border: i < 3 ? 'none'
                    : `1.5px solid ${isPhoto ? 'rgba(255,255,255,.45)' : fg}`,
                  opacity: i < 3 ? 1 : 0.6,
                }} />
            ))}
          </span>
        </span>

        <span className="block px-3 pb-2.5 pt-2">
          <span className="block text-[8px] font-bold uppercase tracking-[0.14em]"
                style={{ color: label }}>Reward</span>
          <span className="block text-[11px] font-semibold">Free drink</span>
        </span>
      </span>

      <span className="mt-2 block px-0.5">
        <span className="block text-[13px] font-semibold">{name}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{blurb}</span>
      </span>
    </button>
  )
}
