import { query } from '@wl/db'
import Link from 'next/link'
import { PRODUCT_NAME } from '@/lib/product'

export const dynamic = 'force-dynamic'

/** A development index — every store, with links. Not part of the product. */
export default async function Home() {
  let stores: { slug: string; name: string; company: string }[] = []
  let dbError: string | null = null

  try {
    stores = await query<{ slug: string; name: string; company: string }>(
      `select s.slug, s.name, c.name as company
         from stores s join companies c on c.id = s.company_id
        where s.active order by c.name, s.created_at`,
    )
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e)
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
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
            Stores
          </h2>
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {stores.length === 0 && (
              <li className="py-3 text-sm text-neutral-500">
                None yet — run <code className="font-mono">pnpm db:seed</code>.
              </li>
            )}
            {stores.map((s) => (
              <li key={s.slug} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm">
                  <span className="font-medium">{s.company}</span>
                  <span className="text-neutral-500"> · {s.name}</span>
                </span>
                <span className="flex flex-none gap-3 text-sm">
                  <Link href={`/j/${s.slug}`} className="text-blue-600 hover:underline">join</Link>
                  <Link href={`/scan?store=${s.slug}`} className="text-blue-600 hover:underline">scan</Link>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
