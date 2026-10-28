'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Card, Field, Logo, Notice, PageTitle, inputClass } from '@/components/ui'
import { postJson } from '@/lib/post'

/**
 * Asking for a reset link.
 *
 * The confirmation says "if there is an account" rather than "we sent it",
 * because the server genuinely does not tell us which. Saying "sent!" to
 * someone who typed the wrong address leaves them refreshing an inbox that
 * will never receive anything.
 */
export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const result = await postJson('/api/owner/forgot', { email })
    setBusy(false)
    if (!result.ok) { setError(result.message); return }
    setSent(true)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col justify-center px-5 py-10">
      <Logo />
      <div className="mt-8"><PageTitle>Forgot your password?</PageTitle></div>

      <Card className="mt-7">
        {sent ? (
          <div className="space-y-4">
            <Notice tone="success">
              If there is an account for <strong>{email}</strong>, a link to choose a
              new password is on its way. It works for one hour.
            </Notice>
            <p className="text-[13.5px] leading-snug text-muted">
              Nothing after a few minutes? Check your junk folder, then try again
              with another address — it is easy to sign up with a typo.
            </p>
            <Button onClick={() => { setSent(false); setError(null) }} full>
              Try a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <p className="text-[13.5px] leading-snug text-muted">
              Enter the email you signed up with and we will send you a link to
              choose a new one.
            </p>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     autoComplete="email" required autoFocus className={inputClass} />
            </Field>
            <Button type="submit" disabled={busy} full>
              {busy ? 'Sending…' : 'Send me a link'}
            </Button>
            {error && <Notice tone="error">{error}</Notice>}
          </form>
        )}
      </Card>

      <p className="mt-6 text-center text-[13.5px] text-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-link hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  )
}
