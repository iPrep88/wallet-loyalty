'use client'

import { stripPath } from '@wl/shared/strip-url'
import { dealQualifier } from '@wl/shared/rewards'

export interface PreviewProgram {
  id: string
  design_version: number
  card_style: string
  stamps_required: number
  reward_in_grid: boolean
  reward_text: string
  logo_url: string | null
  bg_color: string
  fg_color: string
  label_color: string
}

/**
 * The card as the customer's phone will draw it.
 *
 * Deliberately a mock of the real wallet layout rather than a free-form
 * design: Apple fixes where the logo, the count and the band go, so showing
 * an owner anything else would be promising a card we cannot make.
 */
export default function CardPreview({
  program, shopName, storeName, stamps = 0,
}: {
  program: PreviewProgram
  shopName: string
  storeName?: string
  stamps?: number
}) {
  const ready = stamps >= program.stamps_required
  // Every mode draws the band — the modes differ in what is behind the marks,
  // not whether there are marks.
  const showsBand = true

  const strip = stripPath({
    programId: program.id,
    designVersion: program.design_version,
    state: ready ? 'reward_ready' : 'collecting',
    count: Math.min(stamps, program.stamps_required),
    scale: 2,
  })

  return (
    <div
      className="overflow-hidden rounded-[18px] shadow-xl ring-1 ring-black/10"
      style={{ backgroundColor: program.bg_color, color: program.fg_color }}
    >
      {/* Logo row and the count, where Apple puts them.
          The name sits BESIDE the logo rather than instead of it, because
          that is what a real pass does: the logo is an image and the name is
          `logoText`, and Apple draws both. Showing one or the other here
          would have been a preview of a card we do not make. */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            {program.logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={program.logo_url} alt=""
                   className="h-7 w-auto max-w-[76px] flex-none object-contain" />
            )}
            <span className="min-w-0 truncate text-[13px] font-semibold">{shopName}</span>
          </span>
          {storeName && (
            <span className="mt-0.5 block truncate text-[10px]"
                  style={{ color: program.label_color }}>{storeName}</span>
          )}
        </div>
        <div className="flex-none text-right">
          <div className="text-[9px] uppercase tracking-wider"
               style={{ color: program.label_color }}>Stamps</div>
          <div className="text-[15px] font-semibold tabular-nums leading-tight">
            {ready ? 'READY 🎉' : `${stamps} / ${program.stamps_required}`}
          </div>
        </div>
      </div>

      {showsBand && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={strip} alt="" width={375} height={98}
             className="block w-full" style={{ aspectRatio: '375 / 98' }} />
      )}

      <div className="px-4 pb-4 pt-3">
        <div className="text-[9px] uppercase tracking-wider"
             style={{ color: program.label_color }}>Reward</div>
        <div className="truncate text-[14px] font-medium">{program.reward_text}</div>
        <div className="mt-0.5 truncate text-[10px]" style={{ color: program.label_color }}>
          {dealQualifier(program.stamps_required, program.reward_in_grid)}
        </div>
      </div>

      {/* The QR, which is why the band above it is as short as it is. The
          caption is the pass's barcode altText — Apple draws it under the code
          itself, so staff and customer both know what the thing is for.

          Hidden on a phone. It is a placeholder — the real code is the last
          screen — and it is 250 pixels of a 812-pixel screen, which is the
          difference between seeing the card change as you work and scrolling
          back up to check. */}
      <div className="hidden flex-col items-center gap-1.5 pb-5 lg:flex">
        <div className="size-[72px] rounded-[4px] bg-white p-1.5">
          <div className="size-full"
               style={{
                 backgroundImage: 'repeating-conic-gradient(#111 0% 25%, #fff 0% 50%)',
                 backgroundSize: '12px 12px',
               }} />
        </div>
        <span className="text-[8.5px]" style={{ color: program.label_color }}>
          Show this to staff
        </span>
      </div>
    </div>
  )
}
