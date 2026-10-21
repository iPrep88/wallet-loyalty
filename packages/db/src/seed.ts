import { hashPin } from '@wl/shared'
import { db, query } from './index'

/**
 * One shop, set up the way a real one would be after onboarding. Idempotent —
 * re-running replaces the demo shop rather than piling up duplicates.
 */
const SLUG = 'bubble-tea-co'

async function main() {
  await query(`delete from businesses where slug = $1`, [SLUG])

  const [business] = await query<{ id: string }>(
    `insert into businesses (name, slug, timezone, subscription_status, trial_ends_at)
     values ($1, $2, 'America/Toronto', 'trialing', now() + interval '30 days')
     returning id`,
    ['Bubble Tea Co', SLUG],
  )

  const [program] = await query<{ id: string }>(
    `insert into programs
       (business_id, stamps_required, reward_text, join_bonus, cooldown_seconds,
        stamp_icon, bg_color, fg_color, label_color, back_address, back_hours)
     values ($1, 10, 'Free drink', 1, 120, 'boba',
             '#2B1B4A', '#F7D8E8', '#B9A3D6',
             '1 Dundas St W, Toronto', 'Mon–Sun 11am–9pm')
     returning id`,
    [business!.id],
  )

  for (const [name, pin] of [['Amy', '1234'], ['Ken', '5678']] as const) {
    await query(
      `insert into staff (business_id, name, pin_hash) values ($1, $2, $3)`,
      [business!.id, name, await hashPin(pin)],
    )
  }

  console.log(`✓ seeded "${SLUG}"`)
  console.log(`  business ${business!.id}`)
  console.log(`  program  ${program!.id}`)
  console.log(`  staff    Amy / 1234, Ken / 5678`)
  console.log(`  join     /j/${SLUG}`)
  console.log(`  scanner  /scan?shop=${SLUG}`)
  await db().end()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
