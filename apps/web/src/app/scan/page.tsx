import Scanner from './Scanner'

export const dynamic = 'force-dynamic'

/**
 * The manifest is declared HERE rather than site-wide on purpose. iOS installs
 * whatever page you are standing on, and what a shop wants on its counter
 * phone is the scanner — not the marketing site, and not the owner dashboard.
 * Hence a scope of /scan and a start_url that lands straight on it.
 */
export const metadata = {
  title: 'Repio Scanner',
  manifest: '/scanner.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Repio',
    statusBarStyle: 'default' as const,
  },
}

export const viewport = { themeColor: '#1D6EFE' }

export default async function ScanPage(
  { searchParams }: { searchParams: Promise<{ store?: string }> },
) {
  const { store } = await searchParams
  return <Scanner defaultSlug={store ?? ''} />
}
