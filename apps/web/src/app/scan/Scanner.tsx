'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const UNDO_WINDOW = 30
const MAX_QUANTITY = 10

interface MemberSummary {
  memberId: string
  firstName: string | null
  shortId: string
  stamps: number
  stampsRequired: number
  rewardsEarned: number
  totalVisits: number
  state: 'collecting' | 'reward_ready'
  header: string
  message: string
  rewardText: string
  cooldownRemaining?: number
  added?: number
  notAdded?: number
}

type View =
  | { kind: 'pin' }
  | { kind: 'camera' }
  | { kind: 'confirm'; token: string; member: MemberSummary }
  | { kind: 'done'; member: MemberSummary; eventId: string | null; note: string }

/** Stable per device, so the PIN lockout has something to count against. */
function deviceId(): string {
  const key = 'wl_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export default function Scanner({ defaultSlug }: { defaultSlug: string }) {
  const [slug, setSlug] = useState(defaultSlug)
  const [pin, setPin] = useState('')
  const [staffName, setStaffName] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'pin' })
  const [quantity, setQuantity] = useState(1)
  const [manualToken, setManualToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [undoLeft, setUndoLeft] = useState(0)

  // The 30-second undo countdown.
  useEffect(() => {
    if (undoLeft <= 0) return
    const t = setTimeout(() => setUndoLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [undoLeft])

  const post = useCallback(async <T,>(path: string, payload: unknown) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as T & { ok: boolean; message?: string }
    return { res, data }
  }, [])

  async function signIn() {
    setBusy(true); setError(null)
    const { res, data } = await post<{ staff: { name: string } }>('/api/staff/pin', {
      slug, deviceId: deviceId(), pin,
    })
    setBusy(false); setPin('')
    if (!res.ok || !data.ok) { setError(data.message ?? 'Sign in failed.'); return }
    setStaffName(data.staff.name)
    setView({ kind: 'camera' })
  }

  async function resolveToken(token: string) {
    setBusy(true); setError(null)
    const { res, data } = await post<{ member: MemberSummary }>('/api/scan/resolve', { token })
    setBusy(false)
    if (!res.ok || !data.ok) { setError(data.message ?? 'Could not read that card.'); return }
    setQuantity(1)
    setView({ kind: 'confirm', token, member: data.member })
  }

  async function commitStamp(token: string) {
    setBusy(true); setError(null)
    const { res, data } = await post<{ member: MemberSummary }>('/api/scan/stamp', {
      token, quantity, client_event_id: crypto.randomUUID(),
    })
    setBusy(false)
    if (!res.ok || !data.ok) { setError(data.message ?? 'Could not add the stamp.'); return }

    const note = data.member.notAdded
      ? `${data.member.added} added — ${data.member.notAdded} not added, card is full`
      : `+${data.member.added} stamp${data.member.added === 1 ? '' : 's'}`
    setUndoLeft(UNDO_WINDOW)
    setView({ kind: 'done', member: data.member, eventId: null, note })
    if (navigator.vibrate) navigator.vibrate(40)
  }

  async function commitRedeem(token: string) {
    setBusy(true); setError(null)
    const { res, data } = await post<{ member: MemberSummary }>('/api/scan/redeem', {
      token, client_event_id: crypto.randomUUID(),
    })
    setBusy(false)
    if (!res.ok || !data.ok) { setError(data.message ?? 'Could not redeem.'); return }
    setUndoLeft(UNDO_WINDOW)
    setView({ kind: 'done', member: data.member, eventId: null, note: 'Reward redeemed' })
    if (navigator.vibrate) navigator.vibrate([30, 60, 30])
  }

  function reset() {
    setError(null); setManualToken(''); setUndoLeft(0)
    setView({ kind: 'camera' })
  }

  // ------------------------------------------------------------------ render
  if (view.kind === 'pin') {
    return (
      <Shell title="Staff sign in">
        <label className="block text-sm text-neutral-500">
          Shop
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="bubble-tea-co"
            className="mt-1.5 w-full rounded-xl border border-neutral-300 px-4 py-3 text-base
                       dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="mt-5 block text-sm text-neutral-500">
          4-digit PIN
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="mt-1.5 w-full rounded-xl border border-neutral-300 px-4 py-3
                       text-center text-2xl tracking-[0.5em]
                       dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <Button onClick={signIn} disabled={busy || pin.length !== 4 || !slug}>
          {busy ? 'Checking…' : 'Start scanning'}
        </Button>
        <ErrorNote error={error} />
      </Shell>
    )
  }

  if (view.kind === 'camera') {
    return (
      <Shell title="Scan a card" subtitle={staffName ? `Signed in as ${staffName}` : undefined}>
        <CameraReader onToken={resolveToken} />
        <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <label className="block text-sm text-neutral-500">
            Or paste a card token
            <input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="eyJ…"
              className="mt-1.5 w-full rounded-xl border border-neutral-300 px-4 py-3
                         font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <Button
            onClick={() => resolveToken(manualToken.trim())}
            disabled={busy || !manualToken.trim()}
            variant="secondary"
          >
            {busy ? 'Reading…' : 'Look up card'}
          </Button>
        </div>
        <ErrorNote error={error} />
      </Shell>
    )
  }

  if (view.kind === 'confirm') {
    const { member, token } = view
    const ready = member.state === 'reward_ready'
    return (
      <Shell title={member.firstName ?? `Member ${member.shortId}`}>
        <p className="text-sm text-neutral-500">
          {member.stamps} / {member.stampsRequired} · {member.totalVisits} visit
          {member.totalVisits === 1 ? '' : 's'} · {member.rewardsEarned} reward
          {member.rewardsEarned === 1 ? '' : 's'}
        </p>

        {ready ? (
          <>
            <p className="mt-8 text-center text-2xl font-semibold">
              Redeem {member.rewardText}?
            </p>
            <Button onClick={() => commitRedeem(token)} disabled={busy} variant="reward">
              {busy ? 'Redeeming…' : 'Yes, redeem'}
            </Button>
          </>
        ) : (
          <>
            {member.cooldownRemaining ? (
              <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800
                            dark:bg-amber-950/40 dark:text-amber-300">
                Stamped {member.cooldownRemaining}s ago — wait before stamping again.
              </p>
            ) : null}

            <div className="mt-8 flex items-center justify-center gap-6">
              <Stepper label="−" onClick={() => setQuantity((q) => Math.max(1, q - 1))} />
              <span className="min-w-16 text-center text-5xl font-semibold tabular-nums">
                {quantity}
              </span>
              <Stepper
                label="+"
                onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
              />
            </div>
            <p className="mt-2 text-center text-xs text-neutral-500">
              stamp{quantity === 1 ? '' : 's'}
            </p>

            <Button onClick={() => commitStamp(token)} disabled={busy}>
              {busy ? 'Saving…' : `Add ${quantity} stamp${quantity === 1 ? '' : 's'}`}
            </Button>
          </>
        )}

        <Button onClick={reset} variant="ghost">Cancel</Button>
        <ErrorNote error={error} />
      </Shell>
    )
  }

  // done
  const { member, note } = view
  const ready = member.state === 'reward_ready'
  return (
    <div
      className={`min-h-dvh px-6 py-10 ${
        ready ? 'bg-amber-500 text-amber-950' : 'bg-emerald-600 text-white'
      }`}
    >
      <div className="mx-auto max-w-sm text-center">
        <p className="text-sm opacity-80">{member.firstName ?? `Member ${member.shortId}`}</p>
        <p className="mt-6 text-6xl font-semibold tabular-nums">
          {member.stamps}<span className="opacity-60">/{member.stampsRequired}</span>
        </p>
        <p className="mt-3 text-lg font-medium">{note}</p>
        <p className="mt-1 text-sm opacity-80">{member.message}</p>

        <button
          onClick={reset}
          className="mt-10 w-full rounded-xl bg-black/15 px-4 py-4 text-base font-semibold"
        >
          Next customer
        </button>

        {undoLeft > 0 && (
          <p className="mt-4 text-sm opacity-80">
            Undo available for {undoLeft}s
          </p>
        )}
        <ErrorNote error={error} />
      </div>
    </div>
  )
}

/**
 * Reads a QR with the browser's own BarcodeDetector where it exists (Android
 * Chrome, recent desktop Chrome). Safari does not implement it, so the manual
 * token field below is the fallback — and the real scanner is the Expo app.
 */
function CameraReader({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'idle' | 'running' | 'unsupported' | 'denied'>('idle')

  useEffect(() => {
    const Detector = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => {
      detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>
    } }).BarcodeDetector

    if (!Detector) { setState('unsupported'); return }

    let stream: MediaStream | undefined
    let raf = 0
    let stopped = false
    const detector = new Detector({ formats: ['qr_code'] })

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setState('running')

        const tick = async () => {
          if (stopped || !videoRef.current) return
          try {
            const found = await detector.detect(videoRef.current)
            const value = found[0]?.rawValue
            if (value) { onToken(value); return }
          } catch { /* a frame that cannot be decoded is normal */ }
          raf = requestAnimationFrame(() => void tick())
        }
        void tick()
      } catch {
        setState('denied')
      }
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onToken])

  if (state === 'unsupported' || state === 'denied') {
    return (
      <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600
                    dark:bg-neutral-900 dark:text-neutral-400">
        {state === 'denied'
          ? 'Camera access was declined — use the token field below.'
          : 'This browser cannot scan QR codes. Use the token field below, or the scanner app.'}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
    </div>
  )
}

function Shell(
  { title, subtitle, children }:
  { title: string; subtitle?: string; children: React.ReactNode },
) {
  return (
    <main className="mx-auto min-h-dvh max-w-sm px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </main>
  )
}

function Button(
  { children, onClick, disabled, variant = 'primary' }: {
    children: React.ReactNode
    onClick: () => void
    disabled?: boolean
    variant?: 'primary' | 'secondary' | 'ghost' | 'reward'
  },
) {
  const styles = {
    primary: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900',
    secondary: 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100',
    ghost: 'text-neutral-500',
    reward: 'bg-amber-500 text-amber-950',
  }[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`mt-6 w-full rounded-xl px-4 py-4 text-base font-semibold
                  transition disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  )
}

function Stepper({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="size-14 rounded-full border border-neutral-300 text-2xl
                 dark:border-neutral-700"
      aria-label={label === '+' ? 'More stamps' : 'Fewer stamps'}
    >
      {label}
    </button>
  )
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700
                  dark:bg-red-950/40 dark:text-red-300">
      {error}
    </p>
  )
}
