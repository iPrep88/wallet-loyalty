import type { DistributionBucket } from '@/lib/stats'

/**
 * Where everyone sits on their card.
 *
 * One ordered series, so: one hue, no legend (the heading names it), and
 * labels only on the buckets worth reading rather than a number over every
 * bar. The bucket one short of a reward is called out because it is the only
 * one that implies an action — those people are a single visit from coming
 * back.
 */
export default function StampDistribution(
  { buckets, stampsRequired }: { buckets: DistributionBucket[]; stampsRequired: number },
) {
  // Pixels, not percentages: a percentage height inside a flex column has no
  // definite parent height to resolve against, so every bar came out at zero.
  const PLOT_HEIGHT = 150
  const peak = Math.max(...buckets.map((b) => b.members), 1)
  const total = buckets.reduce((n, b) => n + b.members, 0)
  const oneAway = stampsRequired - 1
  const biggest = buckets.reduce((a, b) => (b.members > a.members ? b : a), buckets[0]!)

  if (total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8
                    text-center text-sm text-neutral-500 dark:border-neutral-800">
        Nothing to show yet — this fills in as customers collect stamps.
      </p>
    )
  }

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: `${PLOT_HEIGHT + 18}px` }}>
        {buckets.map((b) => {
          // A bucket with people in it always draws something, so "a few" never
          // looks the same as "none".
          const px = b.members === 0 ? 0 : Math.max(3, Math.round((b.members / peak) * PLOT_HEIGHT))
          const notable = b.stamps === oneAway || b.stamps === biggest.stamps
          return (
            <div key={b.stamps} className="group relative flex flex-1 flex-col justify-end">
              {notable && b.members > 0 && (
                <span className="mb-1 text-center text-[11px] font-medium tabular-nums
                                 text-neutral-600 dark:text-neutral-400">
                  {b.members}
                </span>
              )}
              <div
                className="w-full rounded-t-[4px] bg-[var(--bar)] transition-opacity
                           group-hover:opacity-80"
                style={{ height: `${px}px` }}
              />
              {/* Hover detail, since a bar alone cannot say which bucket it is. */}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1
                               hidden -translate-x-1/2 whitespace-nowrap rounded-md
                               bg-neutral-900 px-2 py-1 text-[11px] text-white
                               group-hover:block dark:bg-neutral-100 dark:text-neutral-900">
                {b.members} {b.members === 1 ? 'person' : 'people'} on {b.stamps}
                {b.stamps === stampsRequired ? ' — card full' : ''}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 flex gap-[2px] border-t border-neutral-200 pt-1.5
                      dark:border-neutral-800">
        {buckets.map((b) => (
          <span key={b.stamps}
                className="flex-1 text-center text-[10px] tabular-nums text-neutral-400">
            {b.stamps}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-neutral-500">
        Stamps collected. {buckets[oneAway]?.members
          ? `${buckets[oneAway].members} ${buckets[oneAway].members === 1 ? 'person is' : 'people are'} one visit from a reward.`
          : 'Nobody is one visit away yet.'}
      </p>
    </div>
  )
}
