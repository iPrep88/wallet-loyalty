import { query } from '@wl/db'
import { ownerContext } from '@/lib/owner-data'
import { err } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * The owner's customer list, as a spreadsheet.
 *
 * Here because "can I take my data with me?" is a question worth answering
 * before it is asked — it costs nothing and removes an objection in every
 * third shop. Phone numbers are included because they are the shop's own
 * customer records; what they may then DO with them is a consent question,
 * which is why the consent column is in the file rather than left implied.
 */
export async function GET(req: Request) {
  const ctx = await ownerContext()
  if (!ctx) return err('bad_pin', 'Please sign in.')

  const slug = new URL(req.url).searchParams.get('store')
  const store = ctx.stores.find((s) => s.slug === slug) ?? ctx.stores[0]
  if (!store) return err('not_found', 'No location found.')

  const rows = await query<{
    first_name: string | null; phone: string | null; stamps: number
    total_visits: number; rewards_earned: number
    joined: Date; last_visit: Date | null; consent: Date | null
  }>(
    `select first_name, phone, stamps, total_visits, rewards_earned,
            created_at as joined, last_visit_at as last_visit, sms_consent_at as consent
       from members where store_id = $1
      order by created_at`,
    [store.id],
  )

  const header = [
    'First name', 'Phone', 'Stamps', 'Visits', 'Rewards earned',
    'Joined', 'Last visit', 'Agreed to be texted',
  ]
  const body = rows.map((r) => [
    r.first_name ?? '',
    r.phone ?? '',
    String(r.stamps),
    String(r.total_visits),
    String(r.rewards_earned),
    iso(r.joined),
    iso(r.last_visit),
    r.consent ? iso(r.consent) : 'no',
  ])

  const csv = [header, ...body].map((cells) => cells.map(escape).join(',')).join('\r\n')
  const filename = `${store.slug}-customers-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response('﻿' + csv, {   // BOM, so Excel reads accents correctly
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * A cell starting with = + - or @ is executed as a formula when the file is
 * opened, so a phone number typed as "=cmd|..." becomes an attack on whoever
 * opens the spreadsheet. Prefix it out of formula position.
 */
function escape(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function iso(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : ''
}
