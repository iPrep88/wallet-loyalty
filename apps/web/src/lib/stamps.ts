import { one, query, tx, type Member, type Program } from '@wl/db'
import {
  cardState, headerValue, stampChangeMessage,
  MAX_STAMP_QUANTITY, UNDO_WINDOW_SECONDS, verifyMemberToken,
} from '@wl/shared'
import { enqueue } from './jobs'

/** What the scanner shows after any successful action. */
export interface MemberSummary {
  memberId: string
  serial: string
  firstName: string | null
  shortId: string
  stamps: number
  stampsRequired: number
  rewardsEarned: number
  totalVisits: number
  state: 'collecting' | 'reward_ready'
  header: string
  message: string
  rewardText: string
}

export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; code: ScanError; message: string; retryAfterSeconds?: number }

export type ScanError =
  | 'bad_token'
  | 'wrong_shop'
  | 'not_found'
  | 'cooldown'
  | 'card_full'
  | 'not_ready'
  | 'undo_expired'
  | 'undo_forbidden'
  | 'already_undone'
  | 'bad_request'
  | 'subscription_inactive'

interface Loaded {
  member: Member
  program: Program
  businessId: string
  subscriptionStatus: string
}

function summarize(member: Member, program: Program): MemberSummary {
  return {
    memberId: member.id,
    serial: member.serial,
    firstName: member.first_name,
    // Something a staff member can read aloud when there is no name.
    shortId: `#${member.serial.slice(0, 4).toUpperCase()}`,
    stamps: member.stamps,
    stampsRequired: program.stamps_required,
    rewardsEarned: member.rewards_earned,
    totalVisits: member.total_visits,
    state: cardState(member.stamps, program.stamps_required),
    header: headerValue(member.stamps, program.stamps_required),
    message: stampChangeMessage(
      member.stamps, program.stamps_required, program.reward_text,
    ),
    rewardText: program.reward_text,
  }
}

/**
 * Turns a scanned QR into a member, and checks the card belongs to the shop
 * doing the scanning — a scanner must never be able to stamp a competitor's
 * card, even with a valid signature.
 */
async function load(token: string, scanningBusinessId: string): Promise<Outcome<Loaded>> {
  const claims = verifyMemberToken(token)
  if (!claims) {
    return { ok: false, code: 'bad_token', message: 'That is not one of our cards.' }
  }

  const row = await one<Member & {
    p: Program
    business_id: string
    subscription_status: string
  }>(
    `select m.*,
            to_jsonb(p.*) as p,
            p.business_id,
            b.subscription_status
       from members m
       join programs p   on p.id = m.program_id
       join businesses b on b.id = p.business_id
      where m.serial = $1 and m.program_id = $2`,
    [claims.serial, claims.programId],
  )

  if (!row) {
    return { ok: false, code: 'not_found', message: 'Card not found.' }
  }
  if (row.business_id !== scanningBusinessId) {
    return { ok: false, code: 'wrong_shop', message: 'That card belongs to another shop.' }
  }

  return {
    ok: true,
    data: {
      member: row,
      program: row.p,
      businessId: row.business_id,
      subscriptionStatus: row.subscription_status,
    },
  }
}

export async function resolve(
  token: string,
  businessId: string,
): Promise<Outcome<MemberSummary & { cooldownRemaining: number }>> {
  const loaded = await load(token, businessId)
  if (!loaded.ok) return loaded

  const { member, program } = loaded.data
  return {
    ok: true,
    data: { ...summarize(member, program), cooldownRemaining: cooldownRemaining(member, program) },
  }
}

/**
 * Seconds left on the cooldown, measured from the last STAFF stamp.
 *
 * Not from the join bonus: a customer scans the counter QR while standing at
 * the till, and the staff member stamps the drink they just bought seconds
 * later. Measuring from the join would refuse that first legitimate stamp.
 */
function cooldownRemaining(member: Member, program: Program): number {
  if (!member.last_staff_stamp_at) return 0
  const elapsed = (Date.now() - new Date(member.last_staff_stamp_at).getTime()) / 1000
  return Math.max(0, Math.ceil(program.cooldown_seconds - elapsed))
}

export interface StampArgs {
  token: string
  businessId: string
  staffId: string
  quantity: number
  clientEventId: string
  /** The owner can wave a card through a cooldown. Staff cannot. */
  override?: boolean
}

export async function addStamps(
  args: StampArgs,
): Promise<Outcome<MemberSummary & { added: number; notAdded: number; duplicate: boolean }>> {
  const { token, businessId, staffId, clientEventId, override = false } = args
  const quantity = Math.floor(args.quantity)

  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_STAMP_QUANTITY) {
    return {
      ok: false, code: 'bad_request',
      message: `Quantity must be between 1 and ${MAX_STAMP_QUANTITY}.`,
    }
  }

  const loaded = await load(token, businessId)
  if (!loaded.ok) return loaded
  const { program } = loaded.data
  let { member } = loaded.data

  // An already-seen client_event_id means a retry — of an offline sync, or of a
  // request whose response never made it back. Return the state as it stands
  // rather than stamping twice.
  const seen = await one<{ id: string }>(
    `select id from stamp_events where client_event_id = $1`, [clientEventId],
  )
  if (seen) {
    return {
      ok: true,
      data: { ...summarize(member, program), added: 0, notAdded: 0, duplicate: true },
    }
  }

  const remaining = cooldownRemaining(member, program)
  if (remaining > 0 && !override) {
    return {
      ok: false, code: 'cooldown', retryAfterSeconds: remaining,
      message: `Already stamped. Try again in ${remaining}s.`,
    }
  }

  if (member.stamps >= program.stamps_required) {
    return {
      ok: false, code: 'card_full',
      message: `Card is full — redeem the ${program.reward_text.toLowerCase()} first.`,
    }
  }

  // The card cannot go past full, so a customer at 9/10 buying two drinks gets
  // one stamp and is told the other was not added. Capping (rather than letting
  // stamps overflow) is what keeps "redeem resets to 0" truthful.
  const room = program.stamps_required - member.stamps
  const added = Math.min(quantity, room)
  const notAdded = quantity - added

  const updated = await tx(async (client) => {
    await client.query(
      `insert into stamp_events (member_id, staff_id, type, quantity, client_event_id)
       values ($1, $2, 'stamp', $3, $4)`,
      [member.id, staffId, added, clientEventId],
    )
    const { rows } = await client.query<Member>(
      `update members
          set stamps              = stamps + $2,
              total_visits        = total_visits + 1,
              last_visit_at       = now(),
              last_staff_stamp_at = now()
        where id = $1
        returning *`,
      [member.id, added],
    )
    await enqueue('push_member', { memberId: member.id }, client)
    return rows[0]!
  })

  member = updated
  return { ok: true, data: { ...summarize(member, program), added, notAdded, duplicate: false } }
}

export async function redeem(args: {
  token: string
  businessId: string
  staffId: string
  clientEventId: string
}): Promise<Outcome<MemberSummary & { duplicate: boolean }>> {
  const loaded = await load(args.token, args.businessId)
  if (!loaded.ok) return loaded
  const { program } = loaded.data
  let { member } = loaded.data

  const seen = await one<{ id: string }>(
    `select id from stamp_events where client_event_id = $1`, [args.clientEventId],
  )
  if (seen) {
    return { ok: true, data: { ...summarize(member, program), duplicate: true } }
  }

  if (member.stamps < program.stamps_required) {
    return {
      ok: false, code: 'not_ready',
      message: `Not ready yet — ${member.stamps}/${program.stamps_required}.`,
    }
  }

  const updated = await tx(async (client) => {
    await client.query(
      `insert into stamp_events (member_id, staff_id, type, quantity, client_event_id)
       values ($1, $2, 'redeem', $3, $4)`,
      [member.id, args.staffId, program.stamps_required, args.clientEventId],
    )
    const { rows } = await client.query<Member>(
      `update members
          set stamps         = 0,
              rewards_earned = rewards_earned + 1,
              last_visit_at  = now()
        where id = $1
        returning *`,
      [member.id],
    )
    await enqueue('push_member', { memberId: member.id }, client)
    return rows[0]!
  })

  member = updated
  return { ok: true, data: { ...summarize(member, program), duplicate: false } }
}

/**
 * Reverses a stamp or redeem.
 *
 * Open for 30 seconds, and only to the staff member who made it. The undo
 * writes its own row rather than editing history, and `undoes_event_id` is
 * unique — so a retried undo cannot decrement the same stamp twice.
 */
export async function undo(args: {
  eventId: string
  businessId: string
  staffId: string
}): Promise<Outcome<MemberSummary>> {
  const event = await one<{
    id: string
    member_id: string
    staff_id: string | null
    type: string
    quantity: number
    age_seconds: number
    business_id: string
    already_undone: boolean
  }>(
    `select e.id, e.member_id, e.staff_id, e.type, e.quantity,
            extract(epoch from (now() - e.created_at)) as age_seconds,
            p.business_id,
            exists (select 1 from stamp_events u where u.undoes_event_id = e.id)
              as already_undone
       from stamp_events e
       join members  m on m.id = e.member_id
       join programs p on p.id = m.program_id
      where e.id = $1`,
    [args.eventId],
  )

  if (!event || event.business_id !== args.businessId) {
    return { ok: false, code: 'not_found', message: 'That scan is no longer available.' }
  }
  if (event.already_undone) {
    return { ok: false, code: 'already_undone', message: 'That scan was already undone.' }
  }
  if (event.staff_id !== args.staffId) {
    return {
      ok: false, code: 'undo_forbidden',
      message: 'Only the staff member who made the scan can undo it.',
    }
  }
  if (Number(event.age_seconds) > UNDO_WINDOW_SECONDS) {
    return {
      ok: false, code: 'undo_expired',
      message: `Undo is only available for ${UNDO_WINDOW_SECONDS} seconds.`,
    }
  }

  const updated = await tx(async (client) => {
    await client.query(
      `insert into stamp_events
         (member_id, staff_id, type, quantity, undoes_event_id)
       values ($1, $2, 'undo', $3, $4)`,
      [event.member_id, args.staffId, event.quantity, event.id],
    )

    // A redeem gave back the full card and banked a reward; a stamp only added.
    const sql = event.type === 'redeem'
      ? `update members
            set stamps         = $2,
                rewards_earned = greatest(rewards_earned - 1, 0)
          where id = $1 returning *`
      : `update members
            set stamps       = greatest(stamps - $2, 0),
                total_visits = greatest(total_visits - 1, 0)
          where id = $1 returning *`

    const { rows } = await client.query<Member>(sql, [event.member_id, event.quantity])
    await enqueue('push_member', { memberId: event.member_id }, client)
    return rows[0]!
  })

  const program = await one<Program>(
    `select * from programs where id = $1`, [updated.program_id],
  )
  return { ok: true, data: summarize(updated, program!) }
}

/** Events a staff member may still undo, for the scanner's 30-second button. */
export async function recentUndoable(staffId: string): Promise<{ id: string }[]> {
  return query<{ id: string }>(
    `select e.id from stamp_events e
      where e.staff_id = $1
        and e.type in ('stamp','redeem')
        and e.created_at > now() - ($2 || ' seconds')::interval
        and not exists (select 1 from stamp_events u where u.undoes_event_id = e.id)
      order by e.created_at desc`,
    [staffId, String(UNDO_WINDOW_SECONDS)],
  )
}
