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
    pool = new Pool({
      connectionString,
      max: 10,
      // Supabase requires TLS; a local socket must not ask for it.
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
    })
  }
  return pool
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
