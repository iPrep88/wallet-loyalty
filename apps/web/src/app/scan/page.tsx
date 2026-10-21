import Scanner from './Scanner'

export const dynamic = 'force-dynamic'

export default async function ScanPage(
  { searchParams }: { searchParams: Promise<{ shop?: string }> },
) {
  const { shop } = await searchParams
  return <Scanner defaultSlug={shop ?? ''} />
}
