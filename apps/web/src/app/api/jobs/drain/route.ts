import { claim, fail, skip, succeed, type Job } from '@/lib/jobs'
import { isAppleConfigured } from '@wl/passes/apple'
import { isGoogleConfigured, patchLoyaltyObject } from '@wl/passes/google'
import { one, type Member, type Program } from '@wl/db'
import { err, ok } from '@/lib/http'

/**
 * The queue worker. Called by cron, not by a user.
 *
 * Google is wired up; Apple is still a stub. The plumbing either side of
 * both is real, so finishing Apple means filling in one branch rather than
 * reworking how stamps notify cards.
 */
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const given = req.headers.get('authorization')
    if (given !== `Bearer ${expected}`) {
      return err('bad_request', 'Bad cron secret.')
    }
  }

  const jobs = await claim(25)
  let done = 0
  let skipped = 0
  let failed = 0

  for (const job of jobs) {
    try {
      const outcome = await run(job)
      if (outcome === 'skipped') {
        skipped++
      } else {
        await succeed(job.id)
        done++
      }
    } catch (e) {
      await fail(job, e instanceof Error ? e.message : String(e))
      failed++
    }
  }

  return ok({ claimed: jobs.length, done, skipped, failed })
}

async function run(job: Job): Promise<'done' | 'skipped'> {
  switch (job.kind) {
    case 'push_member':
    case 'push_program':
      if (!isAppleConfigured()) {
        await skip(job.id, 'Apple Wallet not configured')
        return 'skipped'
      }
      // TODO(apple): regenerate the pass and send an empty APNs push to every
      // device registered for this member.
      throw new Error('Apple push not implemented')

    case 'google_patch':
      if (!isGoogleConfigured()) {
        await skip(job.id, 'Google Wallet not configured')
        return 'skipped'
      }
      return googlePatch(job)

    case 'strip_warm':
      // Nothing to do: the artwork endpoint renders on demand and is immutable.
      return 'done'

    case 'weekly_digest':
      // TODO(phase 2): the Monday email. Owners will not log in to a
      // dashboard, so the week's numbers go to them instead.
      await skip(job.id, 'weekly digest not implemented yet')
      return 'skipped'

    case 'quiet_store_check':
      // TODO(phase 2): warn when a store has gone several days without a
      // scan. Shops churn because the tablet died and nobody noticed, not
      // because they decided to leave.
      await skip(job.id, 'quiet-store check not implemented yet')
      return 'skipped'
  }
}

/**
 * Push a member's new count to their Google card.
 *
 * Reads the member fresh rather than trusting the payload: jobs can sit in
 * the queue behind others, and by the time this runs the count in the job may
 * be two stamps out of date. The card should show what is true now.
 */
async function googlePatch(job: Job): Promise<'done' | 'skipped'> {
  const memberId = (job.payload as { memberId?: string }).memberId
  if (!memberId) throw new Error('google_patch job has no memberId')

  const row = await one<Member & { program: Program }>(
    `select m.*, to_jsonb(p.*) as program
       from members m
       join stores s   on s.id = m.store_id
       join programs p on p.company_id = s.company_id
      where m.id = $1`,
    [memberId],
  )
  // The member was deleted between the stamp and the drain. Nothing to push.
  if (!row) return 'skipped'

  await patchLoyaltyObject({
    program: row.program,
    member: { serial: row.serial, stamps: row.stamps },
    // The queue runs with no incoming request to take an origin from, so this
    // is the one place the app's public address MUST be configured.
    origin: requireAppUrl(),
  })
  return 'done'
}

function requireAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is not set. Google fetches card artwork from the '
      + 'public internet, so the queue cannot build image URLs without it.',
    )
  }
  return url
}
