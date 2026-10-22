import { notFound } from 'next/navigation'
import { stripPath } from '@wl/shared'
import { storeBySlug } from '@/lib/join'
import JoinForm from './JoinForm'

export const dynamic = 'force-dynamic'

/**
 * The counter QR lands here. Fully the shop's brand — our only mark is the
 * small "Powered by" line at the bottom.
 */
export default async function JoinPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const found = await storeBySlug(slug)
  if (!found) notFound()
  const { store, program, companyName } = found

  const previewStrip = stripPath({
    programId: program.id,
    designVersion: program.design_version,
    state: 'collecting',
    count: 0,
  })

  return (
    <main
      className="min-h-dvh px-6 py-10"
      style={{ backgroundColor: program.bg_color, color: program.fg_color }}
    >
      <div className="mx-auto max-w-sm">
        {program.logo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={program.logo_url} alt={companyName}
               className="mx-auto h-12 w-auto object-contain" />
        ) : (
          <h1 className="text-center text-2xl font-semibold tracking-tight">{companyName}</h1>
        )}
        <p className="mt-1 text-center text-[13px]" style={{ color: program.label_color }}>
          {store.name}
        </p>

        <p className="mt-8 text-center text-3xl font-semibold leading-tight tracking-tight">
          {program.reward_text}
        </p>
        <p className="mt-2 text-center text-sm" style={{ color: program.label_color }}>
          Collect {program.stamps_required} stamps
          {program.join_bonus > 0 && ` — your first one is on us`}
        </p>

        {/* The card as it will look in the wallet. */}
        <div className="mt-8 overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/10"
             style={{ backgroundColor: program.bg_color }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewStrip} alt={`${program.stamps_required} stamp card`}
               width={375} height={98} className="w-full" />
        </div>

        <JoinForm slug={slug} labelColor={program.label_color} fgColor={program.fg_color} />

        {program.back_terms && (
          <p className="mt-10 text-center text-[11px] leading-relaxed"
             style={{ color: program.label_color }}>
            {program.back_terms}
          </p>
        )}
        <p className="mt-6 text-center text-[11px] opacity-50">Powered by Wallet Loyalty</p>
      </div>
    </main>
  )
}
