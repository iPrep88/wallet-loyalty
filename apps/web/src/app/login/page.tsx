'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block text-sm font-medium">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 autoComplete="email" required className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete="current-password" required className={inputClass} />
        </label>

        <button type="submit" disabled={busy}
          className="w-full rounded-xl bg-neutral-900 px-4 py-4 text-base font-semibold
                     text-white transition disabled:opacity-50
                     dark:bg-white dark:text-neutral-900">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700
                        dark:bg-red-950/40 dark:text-red-300">{error}</p>
        )}
      </form>

      <p className="mt-8 text-center text-sm text-neutral-500">
        New here?{' '}
        <Link href="/signup" className="text-blue-600 hover:underline">Set up your shop</Link>
      </p>
    </main>
  )
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-neutral-300 px-4 py-3 text-base ' +
  'focus:border-neutral-900 focus:outline-none ' +
  'dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-400'
