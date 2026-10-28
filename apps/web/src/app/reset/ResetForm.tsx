'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, Field, Logo, Notice, PageTitle, inputClass } from '@/components/ui'
import { postJson } from '@/lib/post'

/**
 * Choosing a new password.
 *
 * Two boxes, not one. A password typed once and never shown is a password
 * that can be mistyped into an account you then cannot get into — and this is
 * the screen people reach precisely because that already happened to them.
 */
export default function ResetForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = again.length > 0 && password !== again

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== again) { setError('Those two passwords are not the same.'); return }
    setBusy(true); setError(null)
    const result = await postJson('/api/owner/reset', { token, password })
    setBusy(false)
    if (!result.ok) { setError(result.message); return }
    // The server signs them in, so there is nothing left to do here.
    router.push('/dashboard')
  }

  if (!token) {
    return (
      <Shell>
        <Notice tone="error">
          That link is missing its code. Open the link from the email itself rather
          than typing the address by hand.
        </Notice>
        <Link href="/forgot"
              className="mt-4 block text-center text-[13.5px] font-semibold text-link
                         hover:underline">
          Send me a new link
        </Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-5">
        <Field label="New password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete="new-password" required autoFocus minLength={8}
                 className={inputClass} />
        </Field>
        <Field label="Type it again">
          <input type="password" value={again} onChange={(e) => setAgain(e.target.value)}
                 autoComplete="new-password" required className={inputClass} />
        </Field>
        {mismatch && (
          <p className="text-[13px] text-muted">Those two do not match yet.</p>
        )}
        <Button type="submit" disabled={busy || mismatch} full>
          {busy ? 'Saving…' : 'Save and sign in'}
        </Button>
        {error && (
          <>
            <Notice tone="error">{error}</Notice>
            <Link href="/forgot"
                  className="block text-center text-[13.5px] font-semibold text-link
                             hover:underline">
              Send me a new link
            </Link>
          </>
        )}
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col justify-center px-5 py-10">
      <Logo />
      <div className="mt-8"><PageTitle>Choose a new password</PageTitle></div>
      <Card className="mt-7">{children}</Card>
    </main>
  )
}
