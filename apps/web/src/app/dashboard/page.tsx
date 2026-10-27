import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatCentsRounded } from '@wl/shared/rewards'
import { ownerContext } from '@/lib/owner-data'
import { byStaff, byStore, customers, daysSinceLastScan, distribution, headline } from '@/lib/stats'
import { Card, Eyebrow, Logo, Notice, SectionTitle } from '@/components/ui'
import StampDistribution from './StampDistribution'
import StaffCodes from './StaffCodes'

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
    <div className="min-h-dvh">
      <header className="border-b border-line-soft">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Logo size={20} />
          <nav className="flex items-center gap-5 text-[13.5px] font-semibold">
            <Link href="/setup" className="text-muted hover:text-ink">Card</Link>
            <a href={`/api/print/qr/${store.slug}.png`} target="_blank" rel="noopener"
               className="text-link hover:underline">Counter code</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Your shop</Eyebrow>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.03em]">
              {ctx.company.name}
            </h1>
          </div>
          {ctx.stores.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {ctx.stores.map((s) => (
                <Link key={s.id} href={`/dashboard?store=${s.slug}`}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    s.id === store.id
                      ? 'bg-accent text-accent-ink'
                      : 'border border-line text-muted hover:text-ink'}`}>
                  {s.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {quietDays !== null && quietDays >= 4 && (
          <div className="mt-6">
            <Notice tone="warn">
              <strong className="font-bold">No scans for {Math.floor(quietDays)} days.</strong>{' '}
              Worth checking the counter code is still out and staff know their PIN.
            </Notice>
          </div>
        )}

        <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Members" value={head.members.toLocaleString('en-CA')}
                foot={`${head.newThisWeek} new this week`} />
          <Tile label="Came back"
                value={head.members ? `${Math.round(head.loyaltyRate * 100)}%` : '—'}
                foot={head.members
                  ? `${head.loyal} of ${head.members} visited twice or more`
                  : 'no members yet'} />
          <Tile label="Visits this week" value={head.visitsThisWeek.toLocaleString('en-CA')}
                foot={deltaText(head.visitsThisWeek, head.visitsLastWeek)} />
          <Tile label="Rewards this month" value={head.rewardsThisMonth.toLocaleString('en-CA')}
                foot={head.valueGivenThisMonthCents != null
                  ? `${formatCentsRounded(head.valueGivenThisMonthCents)} given away`
                  : 'add a reward value to see the cost'} />
        </section>

        {head.valueIncomplete && (
          <p className="mt-3 text-[12.5px] text-muted">
            Some rewards were redeemed before you set a value, so the amount given away
            covers only the ones since.
          </p>
        )}

        <section className="mt-9">
          <SectionTitle>Where everyone is on their card</SectionTitle>
          <Card className="mt-3">
            <StampDistribution buckets={dist} stampsRequired={ctx.program.stamps_required} />
          </Card>
        </section>

        {stores.length > 1 && (
          <section className="mt-9">
            <SectionTitle>By location</SectionTitle>
            <Card className="mt-3" flush>
              <Table head={['Location', 'Members', 'Visits this week', 'Rewards this month']}
                     rows={stores.map((s) => [
                       s.name,
                       s.members.toLocaleString('en-CA'),
                       s.visitsThisWeek.toLocaleString('en-CA'),
                       s.rewardsThisMonth.toLocaleString('en-CA'),
                     ])} />
            </Card>
          </section>
        )}

        <section className="mt-9">
          <SectionTitle>Who can use the scanner</SectionTitle>
          <Card className="mt-3" flush><StaffCodes /></Card>
        </section>

        <section className="mt-9">
          <SectionTitle>By staff member, this month</SectionTitle>
          <Card className="mt-3" flush>
            {staff.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-muted">
                No scans yet this month.
              </p>
            ) : (
              <Table head={['Staff', 'Stamps given', 'Rewards redeemed']}
                     rows={staff.map((s) => [
                       s.name,
                       s.stamps.toLocaleString('en-CA'),
                       s.rewards.toLocaleString('en-CA'),
                     ])} />
            )}
          </Card>
          <p className="mt-2.5 text-[12.5px] leading-snug text-muted">
            Rewards redeemed is the column worth watching — that is free product leaving
            the shop.
          </p>
        </section>

        <section className="mt-9">
          <div className="flex items-baseline justify-between gap-3">
            <SectionTitle>Recent customers</SectionTitle>
            <a href={`/api/owner/export?store=${store.slug}`}
               className="text-[13px] font-semibold text-link hover:underline">
              Download spreadsheet
            </a>
          </div>
          <Card className="mt-3" flush>
            {people.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-muted">
                Nobody has joined yet. Put the counter code where customers can see it.
              </p>
            ) : (
              <Table head={['Customer', 'Stamps', 'Visits', 'Rewards', 'Last seen']}
                     rows={people.map((p) => [
                       p.firstName ?? p.shortId,
                       `${p.stamps} / ${ctx.program.stamps_required}`,
                       String(p.totalVisits),
                       String(p.rewardsEarned),
                       p.lastVisitAt ? relative(new Date(p.lastVisitAt)) : '—',
                     ])} />
            )}
          </Card>
        </section>

        <p className="mt-10 text-[12px] leading-relaxed text-faint">
          Counted in {tz.replace('_', ' ')}, your shop&rsquo;s own time. Scans that staff
          undid are not counted anywhere on this page.
        </p>
      </main>
    </div>
  )
}

function Tile({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <Card className="!p-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1.5 text-[30px] font-extrabold leading-none tracking-[-0.035em] tabular">
        {value}
      </div>
      <div className="mt-2 text-[11.5px] leading-snug text-muted">{foot}</div>
    </Card>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-line-soft">
            {head.map((h, i) => (
              <th key={h}
                  className={`px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.08em]
                              text-faint ${i > 0 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line-soft last:border-0">
              {r.map((cell, j) => (
                <td key={j}
                    className={`px-5 py-3 ${j > 0 ? 'text-right tabular text-muted' : 'font-semibold'}`}>
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

function deltaText(now: number, before: number): string {
  if (before === 0) return now === 0 ? 'none yet' : 'first week with visits'
  const change = Math.round(((now - before) / before) * 100)
  if (change === 0) return 'same as last week'
  return `${change > 0 ? '+' : ''}${change}% vs last week`
}

function relative(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}
