'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Logo, Notice, PageTitle } from '@/components/ui'
import { postJson } from '@/lib/post'

/**
 * Landing on the confirmation link.
 *
 * Confirming happens on arrival, with no button to press — the person already
 * expressed intent by clicking the link in their email, and a second "yes
 * really" is a step that exists only to serve the implementation.
 *
 * The guard below is not ceremony: in development React mounts effects twice,
 * and the second run would spend a token that the first already used, so a
 * working link would report itself invalid every single time.
 */
export default function VerifyPanel({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working')
  const [message, setMessage] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!token) {
      setState('failed')
      setMessage('That link is missing its code. Open it from the email itself.')
      return
    }
    void postJson('/api/owner/verify', { token }).then((result) => {
      if (result.ok) { setState('done'); return }
      setState('failed')
      setMessage(result.message)
    })
  }, [token])

  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col justify-center px-5 py-10">
      <Logo />
      <div className="mt-8">
        <PageTitle>
          {state === 'done' ? 'Email confirmed' : 'Confirming your email'}
        </PageTitle>
      </div>

      <Card className="mt-7 space-y-4">
        {state === 'working' && (
          <p className="text-[14px] text-muted">One moment…</p>
        )}

        {state === 'done' && (
          <>
            <Notice tone="success">
              That is your address confirmed. If you ever forget your password,
              you can get back in.
            </Notice>
            <Link href="/dashboard" className="block">
              <Button full>Go to my dashboard</Button>
            </Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <Notice tone="error">{message}</Notice>
            <p className="text-[13.5px] leading-snug text-muted">
              Confirmation links last 7 days and work once. Sign in and we will
              send you a fresh one.
            </p>
            <Link href="/dashboard" className="block">
              <Button full>Sign in</Button>
            </Link>
          </>
        )}
      </Card>
    </main>
  )
}
