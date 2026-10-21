import { one, tx, type Member, type Program } from '@wl/db'
import { createMemberToken } from '@wl/shared'
import { enqueue } from './jobs'

export interface JoinResult {
  member: Member
  program: Program
  token: string
  existing: boolean
}

/** E.164, loosely: a leading + and 8–15 digits. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  const e164 = digits.startsWith('+') ? digits : `+1${digits}` // Canada/US default
  return /^\+\d{8,15}$/.test(e164) ? e164 : null
}

export async function joinProgram(args: {
  slug: string
  phone?: string | null
  firstName?: string | null
  platform?: 'apple' | 'google' | null
  smsConsent?: boolean
}): Promise<{ ok: true; data: JoinResult } | { ok: false; message: string }> {
  const program = await one<Program & { business_slug: string }>(
    `select p.*, b.slug as business_slug
       from programs p join businesses b on b.id = p.business_id
      where b.slug = $1
      order by p.created_at
      limit 1`,
    [args.slug],
  )
  if (!program) return { ok: false, message: 'Shop not found.' }

  const phone = args.phone ? normalizePhone(args.phone) : null
  if (args.phone && !phone) {
    return { ok: false, message: 'That phone number does not look right.' }
  }

  // A returning customer who gives the same number gets their own card back,
  // not a second one. Without this, recovery could not tell which card to
  // re-issue.
  if (phone) {
    const existing = await one<Member>(
      `select * from members where program_id = $1 and phone = $2`,
      [program.id, phone],
    )
    if (existing) {
      return {
        ok: true,
        data: {
          member: existing,
          program,
          token: createMemberToken({ serial: existing.serial, programId: program.id }),
          existing: true,
        },
      }
    }
  }

  const member = await tx(async (client) => {
    const { rows } = await client.query<Member>(
      `insert into members
         (program_id, phone, first_name, platform, stamps, sms_consent_at,
          total_visits, last_visit_at)
       values ($1, $2, $3, $4, $5, $6, 1, now())
       returning *`,
      [
        program.id,
        phone,
        args.firstName ?? null,
        args.platform ?? null,
        program.join_bonus,
        // CASL: record the moment consent was given, or nothing at all.
        args.smsConsent && phone ? new Date() : null,
      ],
    )
    const created = rows[0]!

    if (program.join_bonus > 0) {
      await client.query(
        `insert into stamp_events (member_id, type, quantity)
         values ($1, 'join', $2)`,
        [created.id, program.join_bonus],
      )
    }
    // Note: last_staff_stamp_at stays null, so the cooldown does not block the
    // first real purchase stamp seconds after joining.
    await enqueue('push_member', { memberId: created.id }, client)
    return created
  })

  return {
    ok: true,
    data: {
      member,
      program,
      token: createMemberToken({ serial: member.serial, programId: program.id }),
      existing: false,
    },
  }
}
