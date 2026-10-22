'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, Field, Logo, Notice, PageTitle, inputClass } from '@/components/ui'

export default function SignupPage() {
  const router = useRouter()
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/owner/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_name: shopName, email, password }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.message ?? 'Something went wrong.'); return }
      router.push('/setup')
    } catch {
      setError('No connection. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col justify-center px-5 py-10">
      <Logo />

      <div className="mt-8">
        <PageTitle sub="Five minutes, and your first month is free. We do not ask for a card.">
          Your stamp card,<br />in their wallet.
        </PageTitle>
      </div>

      <Card className="mt-7">
        <form onSubmit={submit} className="space-y-5">
          <Field label="What is your shop called?" hint="Customers see this on their card.">
            <input value={shopName} onChange={(e) => setShopName(e.target.value)}
                   placeholder="Bubble Tea Co" autoComplete="organization" required
                   className={inputClass} />
          </Field>
          <Field label="Your email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   autoComplete="email" required className={inputClass} />
          </Field>
          <Field label="Pick a password" hint="At least 8 characters. Long beats complicated.">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   autoComplete="new-password" required className={inputClass} />
          </Field>

          <Button type="submit" disabled={busy} full>
            {busy ? 'Creating your shop…' : 'Create my shop'}
          </Button>

          {error && <Notice tone="error">{error}</Notice>}
        </form>
      </Card>

      <p className="mt-6 text-center text-[13.5px] text-muted">
        Already set up?{' '}
        <Link href="/login" className="font-semibold text-link hover:underline">Sign in</Link>
      </p>
    </main>
  )
}
