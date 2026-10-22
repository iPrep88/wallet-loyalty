import Scanner from './Scanner'

export const dynamic = 'force-dynamic'

export default async function ScanPage(
  { searchParams }: { searchParams: Promise<{ store?: string }> },
) {
  const { store } = await searchParams
  return <Scanner defaultSlug={store ?? ''} />
}
