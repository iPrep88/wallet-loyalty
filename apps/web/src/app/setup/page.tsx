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
      }}
      program={JSON.parse(JSON.stringify(ctx.program))}
    />
  )
}
