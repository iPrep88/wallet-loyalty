import { createHash } from 'node:crypto'
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
    checksum   text,
    applied_at timestamptz not null default now()
  )`)
  await query(`alter table _migrations add column if not exists checksum text`)

  const appliedRows = await query<{ name: string; checksum: string | null }>(
    'select name, checksum from _migrations',
  )
  const applied = new Map(appliedRows.map((r) => [r.name, r.checksum]))
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()

  // A migration that has already run and has since been EDITED will never run
  // again — the tracker only knows filenames — so that database silently
  // diverges from every other one and only fails later, somewhere confusing.
  // Before launch, editing a migration and resetting is the right move; the
  // point is to be told, not to find out three deploys downstream.
  const drifted: string[] = []
  const missing: string[] = []
  for (const [name, checksum] of applied) {
    if (!files.includes(name)) { missing.push(name); continue }
    if (!checksum) continue  // applied before checksums existed; nothing to compare
    const current = sha(await readFile(join(MIGRATIONS, name), 'utf8'))
    if (current !== checksum) drifted.push(name)
  }
  if (drifted.length || missing.length) {
    console.error('\n✗ This database does not match the migrations on disk.\n')
    for (const n of drifted) console.error(`  ${n} was applied, then edited`)
    for (const n of missing) console.error(`  ${n} was applied, then deleted`)
    console.error(
      '\n  Before launch: pnpm db:reset  (drops everything and rebuilds)\n'
      + '  After launch:  never edit an applied migration — add a new one.\n',
    )
    process.exit(1)
  }

  let ran = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(join(MIGRATIONS, file), 'utf8')
    process.stdout.write(`• applying ${file} … `)
    const client = await db().connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into _migrations (name, checksum) values ($1, $2)',
        [file, sha(sql)])
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

function sha(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
