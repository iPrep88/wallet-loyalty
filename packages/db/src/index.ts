import { Pool, type PoolClient, type QueryResultRow } from 'pg'

/**
 * A privileged connection — the local-Postgres equivalent of Supabase's service
 * role. Every caller is a server-side route handler that has already done its
 * own authorization, so RLS is bypassed here by design.
 */
let pool: Pool | undefined

export function db(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    pool = new Pool({ connectionString, max: 10, ssl: sslFor(connectionString) })
  }
  return pool
}


/**
 * Whether to negotiate TLS for this connection.
 *
 * An explicit `sslmode` in the URL wins — that is the standard libpq knob and
 * anyone setting it means it. Otherwise: a database on this machine speaks over
 * a loopback interface nobody else can see, and asking it for TLS fails
 * outright against a server that was never given a certificate. Anything
 * reached across a network gets TLS.
 *
 * Matching on the literal string "localhost" is what this used to do, and it
 * broke the moment a connection string spelled the same machine `127.0.0.1`.
 */
function sslFor(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  let host: string
  let sslmode: string | null
  try {
    const url = new URL(connectionString)
    host = url.hostname
    sslmode = url.searchParams.get('sslmode')
  } catch {
    return undefined
  }

  if (sslmode) return sslmode === 'disable' ? undefined : { rejectUnauthorized: false }

  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === ''
  return isLoopback ? undefined : { rejectUnauthorized: false }
}

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await db().query<T>(sql, params)
  return res.rows
}

export async function one<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(sql, params)
  return rows[0]
}

/** Runs `fn` inside a transaction, rolling back on any throw. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect()
  try {
    await client.query('begin')
    const out = await fn(client)
    await client.query('commit')
    return out
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

export type { PoolClient }
export * from './types'
