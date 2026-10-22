import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatCentsRounded } from '@wl/shared/rewards'
import { ownerContext } from '@/lib/owner-data'
import { byStaff, byStore, customers, daysSinceLastScan, distribution, headline } from '@/lib/stats'
import StampDistribution from './StampDistribution'

export const dynamic = 'force-dynamic'

export default async function Dashboard(
  { searchParams }: { searchParams: Promise<{ store?: string }> },
) {
  const ctx = await ownerContext()
  if (!ctx) redirect('/login')

  const { store: wanted } = await searchParams
  const store = ctx.stores.find((s) => s.slug === wanted) ?? ctx.stores[0]
  if (!store) redirect('/setup')

  const tz = ctx.company.timezone
  const [head, dist, staff, stores, people, quietDays] = await Promise.all([
    headline(store.id, tz),
    distribution(store.id, ctx.program.stamps_required),
    byStaff(store.id, tz),
    ctx.stores.length > 1 ? byStore(ctx.company.id, tz) : Promise.resolve([]),
    customers(store.id, { limit: 12 }),
    daysSinceLastScan(store.id),
  ])

  return (
    <main className="mx-auto max-w-3xl px-5 py-8"
          style={{ ['--bar' as string]: 'var(--bar-color)' }}>
      <style>{`
        :root { --bar-color: #1F6F8B; }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) { --bar-color: #6FB3C9; }
        }
      `}</style>

      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ctx.company.name}</h1>
          {ctx.stores.length > 1 && (
            <p className="mt-0.5 text-sm text-neutral-500">{store.name}</p>
          )}
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/setup" className="text-blue-600 hover:underline">Edit card</Link>
          <a href={`/api/print/qr/${store.slug}.png`} target="_blank" rel="noopener"
             className="text-blue-600 hover:underline">Counter code</a>
        </nav>
      </header>

      {ctx.stores.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ctx.stores.map((s) => (
            <Link key={s.id} href={`/dashboard?store=${s.slug}`}
              className={`rounded-lg border px-3 py-1.5 text-[13px] ${
                s.id === store.id
                  ? 'border-neutral-900 font-medium dark:border-white'
                  : 'border-neutral-200 text-neutral-500 dark:border-neutral-800'}`}>
              {s.name}
            </Link>
          ))}
        </div>
      )}

      {/* The signal that saves accounts: a shop that quietly stopped. */}
      {quietDays !== null && quietDays >= 4 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3
                        text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40
                        dark:text-amber-200">
          <strong className="font-semibold">No scans for {Math.floor(quietDays)} days.</strong>{' '}
          Worth checking the QR stand is still on the counter and staff know their PIN.
        </div>
      )}

      {/* Headline numbers. */}
      <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Members" value={head.members.toLocaleString('en-CA')}
              foot={deltaText(head.newThisWeek, head.newLastWeek, 'new this week')} />
        <Tile label="Came back"
              value={head.members ? `${Math.round(head.loyaltyRate * 100)}%` : '—'}
              foot={head.members ? `${head.loyal} of ${head.members} visited twice or more` : 'no members yet'} />
        <Tile label="Visits this week" value={head.visitsThisWeek.toLocaleString('en-CA')}
              foot={deltaText(head.visitsThisWeek, head.visitsLastWeek, 'vs last week', true)} />
        <Tile label="Rewards this month" value={head.rewardsThisMonth.toLocaleString('en-CA')}
              foot={
                head.valueGivenThisMonthCents != null
                  ? `${formatCentsRounded(head.valueGivenThisMonthCents)} given away`
                  : 'set a reward value to see what it cost'
              } />
      </section>

      {head.valueIncomplete && (
        <p className="mt-3 text-[12px] text-neutral-500">
          Some rewards were redeemed before you set a value, so the amount given away
          covers only the ones since.
        </p>
      )}

      {/* Distribution. */}
      <section className="mt-9">
        <h2 className="text-sm font-semibold">Where everyone is on their card</h2>
        <div className="mt-4">
          <StampDistribution buckets={dist} stampsRequired={ctx.program.stamps_required} />
        </div>
      </section>

      {/* Per location. */}
      {stores.length > 1 && (
        <section className="mt-9">
          <h2 className="text-sm font-semibold">By location</h2>
          <Table head={['Location', 'Members', 'Visits this week', 'Rewards this month']}
                 rows={stores.map((s) => [
                   s.name,
                   s.members.toLocaleString('en-CA'),
                   s.visitsThisWeek.toLocaleString('en-CA'),
                   s.rewardsThisMonth.toLocaleString('en-CA'),
                 ])} />
        </section>
      )}

      {/* Per staff — redemptions are the column that matters. */}
      <section className="mt-9">
        <h2 className="text-sm font-semibold">By staff member, this month</h2>
        {staff.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No scans yet this month.</p>
        ) : (
          <>
            <Table head={['Staff', 'Stamps given', 'Rewards redeemed']}
                   rows={staff.map((s) => [
                     s.name,
                     s.stamps.toLocaleString('en-CA'),
                     s.rewards.toLocaleString('en-CA'),
                   ])} />
            <p className="mt-2 text-[12px] text-neutral-500">
              Rewards redeemed is the one worth watching — that column is free product
              leaving the shop.
            </p>
          </>
        )}
      </section>

      {/* Customers. */}
      <section className="mt-9">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Recent customers</h2>
          <a href={`/api/owner/export?store=${store.slug}`}
             className="text-[13px] text-blue-600 hover:underline">Download all as a spreadsheet</a>
        </div>
        {people.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Nobody has joined yet. Put the counter code somewhere customers can see it.
          </p>
        ) : (
          <Table
            head={['Customer', 'Stamps', 'Visits', 'Rewards', 'Last seen']}
            rows={people.map((p) => [
              p.firstName ?? p.shortId,
              `${p.stamps} / ${ctx.program.stamps_required}`,
              String(p.totalVisits),
              String(p.rewardsEarned),
              p.lastVisitAt ? relative(new Date(p.lastVisitAt)) : '—',
            ])} />
        )}
      </section>

      <p className="mt-10 text-[12px] leading-relaxed text-neutral-400">
        Counted in {tz.replace('_', ' ')}, your shop&rsquo;s own time. Scans that staff
        undid are not included anywhere on this page.
      </p>
    </main>
  )
}

function Tile({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-neutral-500">{foot}</div>
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
            {head.map((h, i) => (
              <th key={h} className={`pb-2 text-[11px] font-medium uppercase tracking-wider
                                      text-neutral-500 ${i > 0 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-0
                                   dark:border-neutral-900">
              {r.map((cell, j) => (
                <td key={j} className={`py-2.5 ${j > 0 ? 'text-right tabular-nums' : 'font-medium'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** "+6 new this week" — with last week's figure only when it says something. */
function deltaText(now: number, before: number, suffix: string, compare = false): string {
  if (!compare) return `${now} ${suffix}`
  if (before === 0) return now === 0 ? `none ${suffix}` : `${now} this week, none last`
  const change = Math.round(((now - before) / before) * 100)
  if (change === 0) return `same as last week`
  return `${change > 0 ? '+' : ''}${change}% ${suffix}`
}

function relative(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}
