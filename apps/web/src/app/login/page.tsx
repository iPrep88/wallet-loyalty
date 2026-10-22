'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, Field, Logo, Notice, PageTitle, inputClass } from '@/components/ui'
import { postJson } from '@/lib/post'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const result = await postJson('/api/owner/login', { email, password })
    setBusy(false)
    if (!result.ok) { setError(result.message); return }
    router.push('/dashboard')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col justify-center px-5 py-10">
      <Logo />
      <div className="mt-8"><PageTitle>Welcome back</PageTitle></div>

      <Card className="mt-7">
        <form onSubmit={submit} className="space-y-5">
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   autoComplete="email" required className={inputClass} />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   autoComplete="current-password" required className={inputClass} />
          </Field>
          <Button type="submit" disabled={busy} full>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {error && <Notice tone="error">{error}</Notice>}
        </form>
      </Card>

      <p className="mt-6 text-center text-[13.5px] text-muted">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-link hover:underline">
          Set up your shop
        </Link>
      </p>
    </main>
  )
}
