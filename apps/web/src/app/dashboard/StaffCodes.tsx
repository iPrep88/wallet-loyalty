'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { patchJson, postJson } from '@/lib/post'
import { inputClass as input } from '@/components/ui'

interface StaffRow { id: string; name: string }

/**
 * Who can sign into the scanner, and the codes they use.
 *
 * A code is shown ONCE, when it is made, because only its hash is kept. That
 * is not a limitation to apologise for — the alternative is every shop's
 * counter codes sitting readable in our database — but it does have to be
 * said out loud at the moment it matters, or an owner comes back looking for
 * a number that was never kept.
 *
 * Resetting takes a second, which is what makes the safe design cost nobody
 * anything.
 */
export default function StaffCodes() {
  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [name, setName] = useState('')
  const [reveal, setReveal] = useState<{ name: string; pin: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  const load = useCallback(async () => {
    // ok() spreads its payload onto the response rather than nesting it under
    // `data`, so the list is at the top level. Reading .data.staff here gave
    // undefined every time, which read as "no staff" and quietly made a
    // second one.
    const res = await fetch('/api/owner/staff')
      .then((r) => r.json() as Promise<{ staff?: StaffRow[] }>)
      .catch(() => null)
    setStaff(res?.staff ?? [])
  }, [])

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    void load()
  }, [load])

  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true); setError(null)
    const res = await postJson<{ pin?: string }>('/api/owner/staff', { name: trimmed })
    setBusy(false)
    if (!res.ok) { setError(res.message); return }
    if (res.data.pin) setReveal({ name: trimmed, pin: res.data.pin })
    setName('')
    void load()
  }

  async function act(row: StaffRow, action: 'reset' | 'remove') {
    setBusy(true); setError(null)
    const res = await patchJson<{ pin?: string }>(
      '/api/owner/staff', { id: row.id, action })
    setBusy(false)
    if (!res.ok) { setError(res.message); return }
    if (action === 'reset' && res.data.pin) setReveal({ name: row.name, pin: res.data.pin })
    void load()
  }

  return (
    <div className="p-5">
      {reveal && (
        <div className="mb-5 rounded-xl border border-accent bg-accent-soft p-4">
          <p className="text-sm font-semibold">{reveal.name}&rsquo;s code</p>
          <p className="mt-2 text-center font-mono text-[36px] font-bold leading-none
                        tracking-[0.2em]">{reveal.pin}</p>
          <p className="mt-3 text-[12.5px] leading-snug text-muted">
            Give it to them now — we store it scrambled and cannot show it again.
            Lost one is one reset away.
          </p>
          <button onClick={() => setReveal(null)}
            className="mt-3 text-[13px] font-semibold text-link hover:underline">
            Done
          </button>
        </div>
      )}

      {staff === null ? (
        <p className="py-4 text-[13.5px] text-muted">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="py-2 text-[13.5px] text-muted">
          Nobody can sign into the scanner yet. Add yourself first.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {staff.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="truncate text-[14.5px] font-medium">{row.name}</span>
              <span className="flex flex-none gap-3 text-[13px]">
                <button onClick={() => void act(row, 'reset')} disabled={busy}
                  className="font-semibold text-link hover:underline disabled:opacity-40">
                  New code
                </button>
                <button onClick={() => void act(row, 'remove')} disabled={busy}
                  className="text-muted hover:text-red-600 disabled:opacity-40">
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <input value={name} placeholder="Add someone — their name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
          className={`${input} flex-1`} />
        <button onClick={() => void add()} disabled={busy || !name.trim()}
          className="flex-none rounded-xl bg-accent px-4 text-[14px] font-semibold
                     text-accent-ink transition-opacity disabled:opacity-40">
          Add
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-300/50 bg-red-500/10 px-3 py-2
                      text-[13px] text-red-700 dark:text-red-200">{error}</p>
      )}

      <p className="mt-3 text-[12.5px] leading-snug text-muted">
        Removing someone stops their code working. Their past scans stay in your
        figures — the history has to keep saying who did what.
      </p>
    </div>
  )
}
