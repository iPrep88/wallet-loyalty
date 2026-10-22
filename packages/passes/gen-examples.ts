/**
 * Renders the example cards shown on the marketing page.
 *
 * Deliberately produced by the real renderer rather than drawn in a design
 * tool: the cards a shop owner sees on the landing page are then literally
 * the cards the product makes, and they cannot drift from it.
 *
 * Run: pnpm --filter @wl/passes gen:examples
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { renderStrip } from './src/strip'
import type { StampIcon } from './src/types'

const OUT = join(process.cwd(), '..', '..', 'apps', 'web', 'public', 'examples')

const BRANDS = [
  { slug: 'maison', bg: '#F4EFE6', fg: '#14110D', stamps: 6,  icon: 'circle' },
  { slug: 'sora',   bg: '#0E1113', fg: '#EDE6DA', stamps: 3,  icon: 'circle' },
  { slug: 'blush',  bg: '#F2D4DC', fg: '#3A1E28', stamps: 7,  icon: 'boba'   },
  { slug: 'north',  bg: '#14271E', fg: '#DDE8DF', stamps: 7,  icon: 'bean'   },
  { slug: 'elio',   bg: '#16130F', fg: '#F0E6D6', stamps: 7,  icon: 'circle' },
] as const

async function main() {
  await mkdir(OUT, { recursive: true })
  for (const b of BRANDS) {
    const png = await renderStrip({
      stamps: b.stamps, stampsRequired: 10, state: 'collecting',
      icon: b.icon as StampIcon,
      bgColor: b.bg, fgColor: b.fg, labelColor: b.fg,
      rewardText: '', width: 375, height: 98, scale: 3,
      style: 'minimal',
    })
    await writeFile(join(OUT, `${b.slug}.png`), png)
    console.log(`  ${b.slug}.png`)
  }

  // The hero cards, shown inside phone frames at a larger size.
  for (const [slug, cfg] of [
    ['hero-maison', { bg: '#F4EFE6', fg: '#14110D', stamps: 6 }],
    ['hero-sora',   { bg: '#0E1113', fg: '#EDE6DA', stamps: 3 }],
  ] as const) {
    const png = await renderStrip({
      stamps: cfg.stamps, stampsRequired: 10, state: 'collecting',
      icon: 'circle', bgColor: cfg.bg, fgColor: cfg.fg, labelColor: cfg.fg,
      rewardText: '', width: 375, height: 98, scale: 3, style: 'minimal',
    })
    await writeFile(join(OUT, `${slug}.png`), png)
    console.log(`  ${slug}.png`)
  }
}
void main()
