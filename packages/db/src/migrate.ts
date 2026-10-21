import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, query } from './index'

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

async function main() {
  const reset = process.argv.includes('--reset')

  if (reset) {
    console.log('• dropping public + auth schemas')
    await query('drop schema if exists public cascade')
    await query('create schema public')
    // Only drop a shimmed auth schema. On Supabase this would be real auth data.
    await query(`do $$
      begin
        if not exists (select 1 from pg_tables where schemaname = 'auth') then
          drop schema if exists auth cascade;
        end if;
      end $$`)
  }

  await query(`create table if not exists _migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  )`)

  const applied = new Set(
    (await query<{ name: string }>('select name from _migrations')).map((r) => r.name),
  )
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()

  let ran = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(join(MIGRATIONS, file), 'utf8')
    process.stdout.write(`• applying ${file} … `)
    const client = await db().connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into _migrations (name) values ($1)', [file])
      await client.query('commit')
      console.log('ok')
      ran++
    } catch (err) {
      await client.query('rollback')
      console.log('FAILED')
      throw err
    } finally {
      client.release()
    }
  }

  console.log(ran === 0 ? '✓ already up to date' : `✓ ${ran} migration(s) applied`)
  await db().end()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
