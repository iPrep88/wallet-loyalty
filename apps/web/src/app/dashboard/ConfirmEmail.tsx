'use client'

import { useState } from 'react'
import { Notice } from '@/components/ui'
import { putJson } from '@/lib/post'

/**
 * The nag for an address nobody has confirmed.
 *
 * It does not block anything, and that is deliberate. Locking an owner out of
 * their own dashboard until an email arrives would cause the exact failure
 * this is here to prevent — someone who mistyped their address would be shut
 * out by the very thing meant to protect them.
 *
 * What it is really for is catching a typo on the day it is made, while the
 * owner is still sitting in front of the screen, rather than three months
 * later when they need a password reset and find out the address was never
 * theirs.
 */
export default function ConfirmEmail({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [message, setMessage] = useState('')

  async function resend() {
    setState('sending')
    const result = await putJson('/api/owner/verify', {})
    if (result.ok) { setState('sent'); return }
    setState('failed')
    setMessage(result.message)
  }

  if (state === 'sent') {
    return (
      <Notice tone="success">
        Sent. Open the email at <strong>{email}</strong> and tap the button in it.
      </Notice>
    )
  }

  return (
    <Notice tone="warn">
      <strong className="font-bold">Confirm your email.</strong>{' '}
      We sent a link to <strong>{email}</strong>. Until you tap it, we cannot be
      sure that address reaches you — and it is the only way back in if you
      forget your password.
      <span className="mt-2 block">
        <button onClick={resend} disabled={state === 'sending'}
                className="font-semibold text-link hover:underline disabled:opacity-60">
          {state === 'sending' ? 'Sending…' : 'Send it again'}
        </button>
        {state === 'failed' && <span className="ml-2 text-muted">{message}</span>}
      </span>
    </Notice>
  )
}
