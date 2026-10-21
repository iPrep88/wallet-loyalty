import { query, type PoolClient } from '@wl/db'
import type { JobKind } from '@wl/db'

/**
 * The wallet-update queue.
 *
 * Nothing that talks to Apple or Google happens inside a request. A design
 * change on a shop with 2,000 members is 2,000 pushes and 2,000 pass
 * re-signings; done inline it would hit the serverless time limit partway
 * through, and there would be no record of which members were missed. So the
 * request enqueues and returns, and a cron worker drains.
 */
export interface Job {
  id: string
  kind: JobKind
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
}

export async function enqueue(
  kind: JobKind,
  payload: Record<string, unknown>,
  client?: PoolClient,
): Promise<void> {
  const sql = `insert into jobs (kind, payload) values ($1, $2::jsonb)`
  const params = [kind, JSON.stringify(payload)]
  if (client) await client.query(sql, params)
  else await query(sql, params)
}

/**
 * Claims up to `limit` jobs atomically. `skip locked` lets several workers (or
 * two overlapping cron runs) drain in parallel without handing the same job out
 * twice.
 */
export async function claim(limit = 25): Promise<Job[]> {
  return query<Job>(
    `update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
      where id in (
        select id from jobs
         where status = 'pending' and run_after <= now()
         order by id
         limit $1
         for update skip locked
      )
      returning id::text, kind, payload, attempts, max_attempts`,
    [limit],
  )
}

export async function succeed(id: string): Promise<void> {
  await query(`update jobs set status = 'done', last_error = null where id = $1`, [id])
}

/** Retries with exponential backoff, then parks the job as failed. */
export async function fail(job: Job, error: string): Promise<void> {
  const exhausted = job.attempts >= job.max_attempts
  if (exhausted) {
    await query(`update jobs set status = 'failed', last_error = $2 where id = $1`,
      [job.id, error])
    return
  }
  const backoffSeconds = Math.min(2 ** job.attempts * 15, 3600)
  await query(
    `update jobs
        set status = 'pending',
            last_error = $2,
            run_after = now() + ($3 || ' seconds')::interval
      where id = $1`,
    [job.id, error, String(backoffSeconds)],
  )
}

/**
 * A job whose provider is not set up yet is not a failure — it is work that
 * cannot exist. Parking it as done keeps the queue honest instead of burning
 * five retries on every stamp until Apple is configured.
 */
export async function skip(id: string, why: string): Promise<void> {
  await query(`update jobs set status = 'done', last_error = $2 where id = $1`,
    [id, `skipped: ${why}`])
}
