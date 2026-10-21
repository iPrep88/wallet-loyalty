import { claim, fail, skip, succeed, type Job } from '@/lib/jobs'
import { isAppleConfigured } from '@wl/passes/apple'
import { isGoogleConfigured } from '@wl/passes/google'
import { err, ok } from '@/lib/http'

/**
 * The queue worker. Called by cron, not by a user.
 *
 * Right now every job is skipped, because neither wallet is configured — but
 * the plumbing either side of that is real, so wiring Apple up later means
 * filling in one branch rather than reworking how stamps notify cards.
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
      // TODO(google): PATCH loyaltyPoints and heroImage on the object.
      throw new Error('Google patch not implemented')

    case 'strip_warm':
      // Nothing to do: the strip endpoint renders on demand and is immutable.
      return 'done'
  }
}
