import { clearOwnerCookie } from '@/lib/owner-auth'
import { ok } from '@/lib/http'

export async function POST() {
  await clearOwnerCookie()
  return ok({})
}
