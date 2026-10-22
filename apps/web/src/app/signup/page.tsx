'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <main className="mx-auto min-h-dvh max-w-sm px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Set up your stamp card</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Takes about five minutes. Your first month is free and we do not ask for a card.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="What is your shop called?" hint="This is what customers will see.">
          <input
            value={shopName} onChange={(e) => setShopName(e.target.value)}
            placeholder="Bubble Tea Co" autoComplete="organization" required
            className={inputClass}
          />
        </Field>
        <Field label="Your email">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" required className={inputClass}
          />
        </Field>
        <Field label="Pick a password" hint="At least 8 characters. Long beats complicated.">
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" required className={inputClass}
          />
        </Field>

        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-neutral-900 px-4 py-4 text-base font-semibold
                     text-white transition disabled:opacity-50
                     dark:bg-white dark:text-neutral-900"
        >
          {busy ? 'Creating your shop…' : 'Create my shop'}
        </button>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700
                        dark:bg-red-950/40 dark:text-red-300">{error}</p>
        )}
      </form>

      <p className="mt-8 text-center text-sm text-neutral-500">
        Already set up?{' '}
        <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
      </p>
    </main>
  )
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-neutral-300 px-4 py-3 text-base ' +
  'focus:border-neutral-900 focus:outline-none ' +
  'dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-400'

function Field(
  { label, hint, children }: { label: string; hint?: string; children: React.ReactNode },
) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {hint && <span className="mt-1.5 block font-normal text-neutral-500">{hint}</span>}
    </label>
  )
}
