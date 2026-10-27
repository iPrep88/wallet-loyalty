'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import InstallPrompt from './InstallPrompt'

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
  | { kind: 'checking' }
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
  // 'checking' rather than 'pin': the session may already be good, and
  // flashing the PIN screen before deciding looks like being signed out.
  const [view, setView] = useState<View>({ kind: 'checking' })
  const [quantity, setQuantity] = useState(1)
  const [manualToken, setManualToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [undoLeft, setUndoLeft] = useState(0)

  // Already signed in? Go straight to the camera. Without this the scanner
  // opened on the PIN screen every time, valid session or not.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/staff/pin')
        const data = await res.json() as {
          ok: boolean; staff?: { name: string }; store?: string
        }
        if (cancelled) return
        if (data.ok && data.staff) {
          setStaffName(data.staff.name)
          setView({ kind: 'camera' })
          return
        }
      } catch { /* offline, or no session: fall through to the PIN screen */ }
      if (!cancelled) setView({ kind: 'pin' })
    })()
    return () => { cancelled = true }
  }, [])

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
    const { res, data } = await post<{ staff: { name: string }; store: string }>('/api/staff/pin', {
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
  if (view.kind === 'checking') {
    return (
      <Shell title="Repio">
        <p className="text-sm text-muted">One moment…</p>
      </Shell>
    )
  }

  if (view.kind === 'pin') {
    return (
      <Shell title="Staff sign in">
        <InstallPrompt />
        <label className="block text-sm text-muted">
          Shop
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="bubble-tea-dundas"
            className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-base"
          />
        </label>
        <label className="mt-5 block text-sm text-muted">
          4-digit PIN
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="mt-1.5 w-full rounded-xl border border-line px-4 py-3
                       text-center text-2xl tracking-[0.5em]"
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
        <InstallPrompt />
        <CameraReader onToken={resolveToken} />
        <div className="mt-6 border-t border-line pt-6">
          <label className="block text-sm text-muted">
            Or paste a card token
            <input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="eyJ…"
              className="mt-1.5 w-full rounded-xl border border-line px-4 py-3
                         font-mono text-xs"
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
        <p className="text-sm text-muted">
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
            <p className="mt-2 text-center text-xs text-muted">
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
        ready ? 'bg-amber-500 text-amber-950' : 'bg-emerald-600 text-accent-ink'
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

interface Detector { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }

/**
 * Finds something that can read a QR code.
 *
 * Chrome has BarcodeDetector built in and it is the fastest path, so it wins
 * when it is there. Safari does not implement it — and EVERY browser on iOS
 * is Safari underneath — so on the iPhone or iPad sitting on a shop counter
 * the camera used to fall straight through to "paste a card token", which no
 * staff member will ever do. That was not a platform limitation; it was a
 * missing decoder.
 *
 * The fallback is the same API backed by ZXing compiled to WebAssembly, which
 * is why none of the code below has to know which one it got. It is imported
 * only when needed, so Chrome never downloads a megabyte it has no use for,
 * and the .wasm is served from our own origin rather than a public CDN — a
 * shop's till should not depend on jsdelivr being up.
 */
async function makeDetector(): Promise<Detector | null> {
  const Native = (globalThis as {
    BarcodeDetector?: new (o: { formats: string[] }) => Detector
  }).BarcodeDetector
  if (Native) return new Native({ formats: ['qr_code'] })

  try {
    const mod = await import('barcode-detector/ponyfill')
    mod.setZXingModuleOverrides({
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + path,
    })
    return new mod.BarcodeDetector({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

/** Reads a QR from the camera, on any phone a shop actually owns. */
function CameraReader({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'idle' | 'running' | 'unsupported' | 'denied'>('idle')

  useEffect(() => {
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    ;(async () => {
      const detector = await makeDetector()
      if (stopped) return
      if (!detector) { setState('unsupported'); return }

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

        // Decoding a full 1080p frame in WebAssembly on a three-year-old phone
        // is slow enough to feel broken. A QR only needs a few hundred pixels
        // across, so every frame is drawn down to this width first.
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        const WIDTH = 540

        const tick = async () => {
          if (stopped || !videoRef.current || !ctx) return
          const v = videoRef.current
          try {
            if (v.videoWidth > 0) {
              canvas.width = WIDTH
              canvas.height = Math.round((v.videoHeight / v.videoWidth) * WIDTH)
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
              const found = await detector.detect(canvas)
              const value = found[0]?.rawValue
              if (value) { onToken(value); return }
            }
          } catch { /* a frame that cannot be decoded is normal */ }
          // A short gap rather than every animation frame: scanning flat out
          // pins a phone's CPU and empties the battery of a device that has to
          // last a shift.
          timer = setTimeout(() => void tick(), 120)
        }
        void tick()
      } catch {
        setState('denied')
      }
    })()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onToken])

  if (state === 'unsupported' || state === 'denied') {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        {state === 'denied'
          ? 'Camera access was declined — allow it in your browser settings, or use the token field below.'
          : 'This browser cannot reach a camera. Use the token field below.'}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
      {state === 'idle' && (
        <p className="py-3 text-center text-[12.5px] text-white/70">Starting the camera…</p>
      )}
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
      {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
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
    primary: 'bg-accent text-accent-ink',
    secondary: 'bg-surface-2 text-ink border border-line',
    ghost: 'text-muted',
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
      className="size-14 rounded-full border border-line text-2xl"
      aria-label={label === '+' ? 'More stamps' : 'Fewer stamps'}
    >
      {label}
    </button>
  )
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200
                  dark:bg-red-950/40 dark:text-red-300">
      {error}
    </p>
  )
}
