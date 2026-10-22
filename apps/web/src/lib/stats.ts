import { query, one } from '@wl/db'

/**
 * The numbers an owner actually cares about.
 *
 * Two rules run through all of this:
 *
 *  - Everything is counted in the SHOP's timezone, not the server's. A Sunday
 *    evening stamp in Toronto belongs to that week, not the next one.
 *
 *  - An undone scan never happened. Staff undo mistakes, and a dashboard that
 *    counts them makes the owner distrust the whole page the first time the
 *    numbers disagree with the till.
 *
 * Nothing here is estimated. Without a till connection we cannot know revenue,
 * so we do not show a figure for it — a number an owner can check and find
 * wrong costs more than the number was ever worth.
 */

/** Events that still stand: not reversed by an undo. */
const LIVE = `not exists (select 1 from stamp_events u where u.undoes_event_id = e.id)`

export interface Headline {
  members: number
  newThisWeek: number
  newLastWeek: number
  visitsThisWeek: number
  visitsLastWeek: number
  loyal: number
  loyaltyRate: number        // share of members who came back at least once
  rewardsAllTime: number
  rewardsThisMonth: number
  valueGivenThisMonthCents: number | null
  valueGivenAllTimeCents: number | null
  /** True when some rewards were redeemed without a value recorded. */
  valueIncomplete: boolean
}

export async function headline(storeId: string, tz: string): Promise<Headline> {
  const row = await one<Record<string, string | null>>(
    `with
      bounds as (
        select date_trunc('week',  (now() at time zone $2)) as week_start,
               date_trunc('week',  (now() at time zone $2)) - interval '7 days' as prev_week,
               date_trunc('month', (now() at time zone $2)) as month_start
      ),
      m as (
        select count(*)                                             as members,
               count(*) filter (where total_visits >= 2)            as loyal,
               count(*) filter (where (created_at at time zone $2)
                                      >= (select week_start from bounds)) as new_this,
               count(*) filter (where (created_at at time zone $2)
                                      >= (select prev_week  from bounds)
                                  and (created_at at time zone $2)
                                      <  (select week_start from bounds)) as new_last
          from members where store_id = $1
      ),
      v as (
        select count(*) filter (where (e.created_at at time zone $2)
                                      >= (select week_start from bounds)) as visits_this,
               count(*) filter (where (e.created_at at time zone $2)
                                      >= (select prev_week  from bounds)
                                  and (e.created_at at time zone $2)
                                      <  (select week_start from bounds)) as visits_last
          from stamp_events e
         where e.store_id = $1 and e.type = 'stamp' and ${LIVE}
      ),
      r as (
        select count(*)                                                  as rewards_all,
               count(*) filter (where (e.created_at at time zone $2)
                                      >= (select month_start from bounds)) as rewards_month,
               sum(e.reward_value_cents)                                 as value_all,
               sum(e.reward_value_cents) filter (where (e.created_at at time zone $2)
                                      >= (select month_start from bounds)) as value_month,
               count(*) filter (where e.reward_value_cents is null)      as missing_value
          from stamp_events e
         where e.store_id = $1 and e.type = 'redeem' and ${LIVE}
      )
     select m.members, m.loyal, m.new_this, m.new_last,
            v.visits_this, v.visits_last,
            r.rewards_all, r.rewards_month, r.value_all, r.value_month, r.missing_value
       from m, v, r`,
    [storeId, tz],
  )

  const n = (k: string) => Number(row?.[k] ?? 0)
  const members = n('members')
  const loyal = n('loyal')
  const rewardsAllTime = n('rewards_all')

  return {
    members,
    newThisWeek: n('new_this'),
    newLastWeek: n('new_last'),
    visitsThisWeek: n('visits_this'),
    visitsLastWeek: n('visits_last'),
    loyal,
    loyaltyRate: members > 0 ? loyal / members : 0,
    rewardsAllTime,
    rewardsThisMonth: n('rewards_month'),
    // Null rather than zero when nothing has a value: "$0 given away" would
    // read as a fact, when it only means the owner never told us what a
    // reward costs.
    valueGivenThisMonthCents: row?.value_month == null ? null : n('value_month'),
    valueGivenAllTimeCents: row?.value_all == null ? null : n('value_all'),
    valueIncomplete: rewardsAllTime > 0 && n('missing_value') > 0,
  }
}

export interface DistributionBucket {
  stamps: number
  members: number
}

/**
 * How many people sit on each stamp count.
 *
 * The useful one on the whole page: a pile at one short of a reward is a pile
 * of people a single visit from coming back.
 */
export async function distribution(
  storeId: string,
  stampsRequired: number,
): Promise<DistributionBucket[]> {
  const rows = await query<{ stamps: string; members: string }>(
    `select s.stamps::text, count(m.id)::text as members
       from generate_series(0, $2) as s(stamps)
       left join members m on m.store_id = $1 and m.stamps = s.stamps
      group by s.stamps order by s.stamps`,
    [storeId, stampsRequired],
  )
  return rows.map((r) => ({ stamps: Number(r.stamps), members: Number(r.members) }))
}

export interface StaffRow {
  staffId: string | null
  name: string
  stamps: number
  rewards: number
}

/**
 * Per staff member.
 *
 * Stamps given is a workload number. Redemptions are the one worth watching —
 * free product is where money quietly leaves a shop, and the only way anyone
 * notices is a column like this one.
 */
export async function byStaff(storeId: string, tz: string): Promise<StaffRow[]> {
  const rows = await query<{ staff_id: string | null; name: string | null
                             stamps: string; rewards: string }>(
    `select e.staff_id, st.name,
            count(*) filter (where e.type = 'stamp')::text  as stamps,
            count(*) filter (where e.type = 'redeem')::text as rewards
       from stamp_events e
       left join staff st on st.id = e.staff_id
      where e.store_id = $1
        and e.type in ('stamp','redeem')
        and ${LIVE}
        and (e.created_at at time zone $2) >= date_trunc('month', (now() at time zone $2))
      group by e.staff_id, st.name
      order by count(*) desc`,
    [storeId, tz],
  )
  return rows.map((r) => ({
    staffId: r.staff_id,
    name: r.name ?? 'Removed staff',
    stamps: Number(r.stamps),
    rewards: Number(r.rewards),
  }))
}

export interface CustomerRow {
  id: string
  firstName: string | null
  shortId: string
  phone: string | null
  stamps: number
  totalVisits: number
  rewardsEarned: number
  lastVisitAt: Date | null
}

export async function customers(
  storeId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<CustomerRow[]> {
  const rows = await query<{
    id: string; first_name: string | null; serial: string; phone: string | null
    stamps: number; total_visits: number; rewards_earned: number
    last_visit_at: Date | null
  }>(
    `select id, first_name, serial, phone, stamps, total_visits, rewards_earned, last_visit_at
       from members where store_id = $1
      order by last_visit_at desc nulls last
      limit $2 offset $3`,
    [storeId, Math.min(opts.limit ?? 50, 500), opts.offset ?? 0],
  )
  return rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    shortId: `#${r.serial.slice(0, 4).toUpperCase()}`,
    phone: r.phone,
    stamps: r.stamps,
    totalVisits: r.total_visits,
    rewardsEarned: r.rewards_earned,
    lastVisitAt: r.last_visit_at,
  }))
}

export interface StoreSummary {
  storeId: string
  name: string
  members: number
  visitsThisWeek: number
  rewardsThisMonth: number
}

/** One row per location, for an owner with more than one. */
export async function byStore(companyId: string, tz: string): Promise<StoreSummary[]> {
  const rows = await query<{
    id: string; name: string; members: string; visits: string; rewards: string
  }>(
    `select s.id, s.name,
            (select count(*) from members m where m.store_id = s.id)::text as members,
            (select count(*) from stamp_events e
              where e.store_id = s.id and e.type = 'stamp' and ${LIVE}
                and (e.created_at at time zone $2)
                    >= date_trunc('week', (now() at time zone $2)))::text as visits,
            (select count(*) from stamp_events e
              where e.store_id = s.id and e.type = 'redeem' and ${LIVE}
                and (e.created_at at time zone $2)
                    >= date_trunc('month', (now() at time zone $2)))::text as rewards
       from stores s
      where s.company_id = $1 and s.active
      order by s.created_at`,
    [companyId, tz],
  )
  return rows.map((r) => ({
    storeId: r.id,
    name: r.name,
    members: Number(r.members),
    visitsThisWeek: Number(r.visits),
    rewardsThisMonth: Number(r.rewards),
  }))
}

/** Days since the last scan anywhere in a store — the quiet-shop signal. */
export async function daysSinceLastScan(storeId: string): Promise<number | null> {
  const row = await one<{ days: string | null }>(
    `select extract(epoch from (now() - max(e.created_at))) / 86400 as days
       from stamp_events e
      where e.store_id = $1 and e.type in ('stamp','redeem','join')`,
    [storeId],
  )
  return row?.days == null ? null : Number(row.days)
}
