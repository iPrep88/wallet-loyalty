import ResetForm from './ResetForm'

/**
 * The token is read here, on the server, and handed down as a prop.
 *
 * Doing it in the browser with useSearchParams would force this whole page
 * behind a Suspense boundary and flash an empty form first. It is in the URL
 * either way; reading it where the page is rendered is simply less machinery.
 */
export default async function ResetPage(
  { searchParams }: { searchParams: Promise<{ token?: string }> },
) {
  const { token } = await searchParams
  return <ResetForm token={token ?? ''} />
}
