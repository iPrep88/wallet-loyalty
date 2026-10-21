import { query } from '@wl/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

/** A development index. Not part of the product. */
export default async function Home() {
  let shops: { slug: string; name: string }[] = []
  let dbError: string | null = null

  try {
    shops = await query<{ slug: string; name: string }>(
      `select slug, name from businesses order by created_at`,
    )
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e)
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Wallet Loyalty</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Foundation build — Apple and Google Wallet are not wired up yet.
      </p>

      {dbError ? (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Database not reachable: {dbError}
        </p>
      ) : (
        <>
          <h2 className="mt-10 text-xs font-medium uppercase tracking-wider text-neutral-400">
            Shops
          </h2>
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {shops.length === 0 && (
              <li className="py-3 text-sm text-neutral-500">
                No shops yet — run <code className="font-mono">pnpm db:seed</code>.
              </li>
            )}
            {shops.map((shop) => (
              <li key={shop.slug} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium">{shop.name}</span>
                <span className="flex gap-3 text-sm">
                  <Link href={`/j/${shop.slug}`} className="text-blue-600 hover:underline">
                    join page
                  </Link>
                  <Link href={`/scan?shop=${shop.slug}`} className="text-blue-600 hover:underline">
                    scanner
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
