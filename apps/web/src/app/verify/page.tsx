import VerifyPanel from './VerifyPanel'

export default async function VerifyPage(
  { searchParams }: { searchParams: Promise<{ token?: string }> },
) {
  const { token } = await searchParams
  return <VerifyPanel token={token ?? ''} />
}
