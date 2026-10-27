import Link from 'next/link'
import { MARK } from '@wl/shared/mark'
import { PRODUCT_NAME } from '@/lib/product'

/**
 * The frame for a legal page.
 *
 * Plain, narrow and readable. These are the pages a shop owner skims before
 * deciding whether to trust you with their customers' phone numbers, and the
 * ones Apple and Google read before letting you issue a card — so they are
 * written to be understood rather than to be impressive.
 */

/** Operator of record. The legal entity, not the product name. */
export const OPERATOR = 'iPrep Global Foods Ltd.'
export const OPERATOR_PLACE = 'Ontario, Canada'
export const CONTACT_EMAIL = 'privacy@tryrepio.com'

/** Changed by hand when the text changes, and shown at the top of the page —
 *  a policy with no date is a policy nobody can tell has moved. */
export const LAST_UPDATED = '27 October 2026'

export default function LegalShell(
  { title, intro, children }:
  { title: string; intro: string; children: React.ReactNode },
) {
  return (
    <main className="mx-auto min-h-dvh max-w-[42rem] px-5 py-10 sm:py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-ink">
        <svg width="22" height="22" viewBox={MARK.viewBox} fill="none" aria-hidden>
          <path d={MARK.arm} stroke="currentColor" strokeWidth={MARK.armWidth}
                strokeLinecap="round" />
          <circle cx={MARK.dot.cx} cy={MARK.dot.cy} r={MARK.dot.r} fill="currentColor" />
        </svg>
        <span className="text-[14px] font-extrabold tracking-[-0.02em]">{PRODUCT_NAME}</span>
      </Link>

      <h1 className="mt-8 text-[clamp(1.7rem,5vw,2.2rem)] font-extrabold leading-[1.12]
                     tracking-[-0.03em]">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{intro}</p>
      <p className="mt-4 text-[12.5px] text-faint">Last updated {LAST_UPDATED}</p>

      <div className="mt-10 space-y-9">{children}</div>

      <div className="mt-14 border-t border-line pt-6 text-[13px] text-muted">
        <p>
          {PRODUCT_NAME} is operated by {OPERATOR}, {OPERATOR_PLACE}.
          {' '}Questions about this page: <a className="text-link hover:underline"
            href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p className="mt-3 flex gap-4">
          <Link href="/legal/privacy" className="text-link hover:underline">Privacy</Link>
          <Link href="/legal/terms" className="text-link hover:underline">Terms</Link>
          <Link href="/" className="text-link hover:underline">Home</Link>
        </p>
      </div>
    </main>
  )
}

export function Section(
  { heading, children }: { heading: string; children: React.ReactNode },
) {
  return (
    <section>
      <h2 className="text-[17px] font-bold tracking-[-0.015em]">{heading}</h2>
      <div className="mt-2.5 space-y-3 text-[14.5px] leading-[1.7] text-ink/85">
        {children}
      </div>
    </section>
  )
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[0.6em] size-1.5 flex-none rounded-full bg-faint" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
