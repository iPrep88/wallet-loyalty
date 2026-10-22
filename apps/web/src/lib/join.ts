import { one, tx, type Member, type Program, type Store } from '@wl/db'
import { createMemberToken } from '@wl/shared'
import { enqueue } from './jobs'

export interface JoinResult {
  member: Member
  program: Program
  store: Store
  token: string
  existing: boolean
}

/** E.164, loosely: a leading + and 8–15 digits. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  const e164 = digits.startsWith('+') ? digits : `+1${digits}` // Canada/US default
  return /^\+\d{8,15}$/.test(e164) ? e164 : null
}

/** The store behind a join URL, with its company's card design. */
export async function storeBySlug(slug: string): Promise<
  { store: Store; program: Program; companyName: string; siblings: number } | null
> {
  const row = await one<{
    store: Store; program: Program; company_name: string; siblings: string
  }>(
    `select to_jsonb(s.*) as store, to_jsonb(p.*) as program, c.name as company_name,
            (select count(*) from stores x where x.company_id = c.id and x.active) as siblings
       from stores s
       join companies c on c.id = s.company_id
       join programs  p on p.company_id = c.id
      where s.slug = $1 and s.active`,
    [slug],
  )
  return row ? {
    store: row.store, program: row.program,
    companyName: row.company_name, siblings: Number(row.siblings),
  } : null
}

export async function joinStore(args: {
  slug: string
  phone?: string | null
  firstName?: string | null
  platform?: 'apple' | 'google' | null
  smsConsent?: boolean
}): Promise<{ ok: true; data: JoinResult } | { ok: false; message: string }> {
  const found = await storeBySlug(args.slug)
  if (!found) return { ok: false, message: 'Shop not found.' }
  const { store, program } = found

  const phone = args.phone ? normalizePhone(args.phone) : null
  if (args.phone && !phone) {
    return { ok: false, message: 'That phone number does not look right.' }
  }

  // A returning customer giving the same number gets their own card back, not
  // a second one. Without this, recovery could not tell which card to re-issue.
  if (phone) {
    const existing = await one<Member>(
      `select * from members where store_id = $1 and phone = $2`, [store.id, phone],
    )
    if (existing) {
      return {
        ok: true,
        data: {
          member: existing, program, store, existing: true,
          token: createMemberToken({ serial: existing.serial, storeId: store.id }),
        },
      }
    }
  }

  const member = await tx(async (client) => {
    const { rows } = await client.query<Member>(
      `insert into members
         (store_id, phone, first_name, platform, stamps, sms_consent_at,
          total_visits, last_visit_at)
       values ($1, $2, $3, $4, $5, $6, 1, now())
       returning *`,
      [
        store.id, phone, args.firstName ?? null, args.platform ?? null,
        program.join_bonus,
        // CASL: record the moment consent was given, or nothing at all.
        args.smsConsent && phone ? new Date() : null,
      ],
    )
    const created = rows[0]!

    if (program.join_bonus > 0) {
      await client.query(
        `insert into stamp_events (member_id, store_id, type, quantity)
         values ($1, $2, 'join', $3)`,
        [created.id, store.id, program.join_bonus],
      )
    }
    // last_staff_stamp_at stays null, so the cooldown does not block the first
    // real purchase stamp seconds after joining.
    await enqueue('push_member', { memberId: created.id }, client)
    return created
  })

  return {
    ok: true,
    data: {
      member, program, store, existing: false,
      token: createMemberToken({ serial: member.serial, storeId: store.id }),
    },
  }
}
