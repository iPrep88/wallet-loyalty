import { redirect } from 'next/navigation'
import { ownerContext } from '@/lib/owner-data'
import SetupFlow from './SetupFlow'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const ctx = await ownerContext()
  if (!ctx) redirect('/login')

  return (
    <SetupFlow
      company={{ name: ctx.company.name, slug: ctx.company.slug }}
      store={{
        name: ctx.stores[0]?.name ?? ctx.company.name,
        slug: ctx.stores[0]?.slug ?? ctx.company.slug,
        address: ctx.stores[0]?.address ?? '',
        // A single-location shop has no use for a branch line under its own
        // name — it is just a second copy of the same words, or worse, a
        // stale one.
        showName: ctx.stores.length > 1,
      }}
      program={JSON.parse(JSON.stringify(ctx.program))}
    />
  )
}
