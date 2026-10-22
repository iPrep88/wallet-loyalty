import { hashPin } from '@wl/shared'
import bcrypt from 'bcryptjs'
import { db, query } from './index'

/**
 * One owner, one company, two stores — set up the way a real signup would
 * leave things, so the dashboard has something to show. Idempotent.
 */
const EMAIL = 'demo@loyalty.test'

async function main() {
  await query(`delete from users where lower(email) = lower($1)`, [EMAIL])

  const [user] = await query<{ id: string }>(
    `insert into users (email, password_hash, name) values ($1, $2, $3) returning id`,
    [EMAIL, await bcrypt.hash('demo1234', 10), 'Demo Owner'],
  )

  const [company] = await query<{ id: string }>(
    `insert into companies (owner_user_id, name, slug, timezone, trial_ends_at)
     values ($1, 'Bubble Tea Co', 'bubble-tea-co', 'America/Toronto',
             now() + interval '30 days')
     returning id`,
    [user!.id],
  )

  await query(
    `insert into programs
       (company_id, stamps_required, reward_text, reward_value_cents,
        card_style, stamp_icon, bg_color, fg_color, label_color, back_hours)
     values ($1, 10, 'Free boba', 700, 'minimal', 'boba',
             '#2B1B4A', '#F7D8E8', '#B9A3D6', 'Mon–Sun 11am–9pm')`,
    [company!.id],
  )

  // Two stores, so the per-location figures have something to separate.
  const stores: { id: string; slug: string }[] = []
  for (const [name, slug, address, lat, lon] of [
    ['Dundas St',  'bubble-tea-dundas',  '1 Dundas St W, Toronto',  43.6561, -79.3802],
    ['Yonge St',   'bubble-tea-yonge',   '500 Yonge St, Toronto',   43.6629, -79.3845],
  ] as const) {
    const [store] = await query<{ id: string; slug: string }>(
      `insert into stores (company_id, name, slug, address, latitude, longitude)
       values ($1, $2, $3, $4, $5, $6) returning id, slug`,
      [company!.id, name, slug, address, lat, lon],
    )
    stores.push(store!)
  }

  for (const store of stores) {
    for (const [name, pin] of [['Amy', '1234'], ['Ken', '5678']] as const) {
      await query(`insert into staff (store_id, name, pin_hash) values ($1, $2, $3)`,
        [store.id, name, await hashPin(pin)])
    }
  }

  console.log('✓ seeded')
  console.log(`  owner    ${EMAIL} / demo1234`)
  console.log(`  company  Bubble Tea Co`)
  for (const s of stores) {
    console.log(`  store    /j/${s.slug}   scanner: /scan?store=${s.slug}`)
  }
  console.log(`  staff    Amy / 1234, Ken / 5678  (at both stores)`)
  await db().end()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
