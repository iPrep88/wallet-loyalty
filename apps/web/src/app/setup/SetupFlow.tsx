'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
// Leaf imports, not the barrel: the barrel re-exports token signing, which
// pulls node:crypto into whatever bundle touches it — and this is a client
// component.
import {
  CARD_STYLES, STAMP_ICONS,
  STAMPS_REQUIRED_SUGGESTED, STAMPS_REQUIRED_MIN, STAMPS_REQUIRED_MAX,
} from '@wl/shared/constants'
import { REWARD_PRESETS, REWARD_MAX_LENGTH } from '@wl/shared/rewards'
import CardPreview, { type PreviewProgram } from './CardPreview'

interface Props {
  company: { name: string; slug: string }
  store: { name: string; slug: string; address: string }
  program: PreviewProgram & {
    band_image_url: string | null
    stamp_icon: string
    reward_value_cents: number | null
    back_hours: string | null
    back_instagram: string | null
    back_menu_url: string | null
  }
}

const STEPS = ['Your shop', 'Your card', 'The deal', 'Details', 'Done'] as const

export default function SetupFlow({ company, store, program: initial }: Props) {
  const [step, setStep] = useState(0)
  const [program, setProgram] = useState(initial)
  const [shopName, setShopName] = useState(company.name)
  const [storeAddress, setStoreAddress] = useState(store.address)
  const [customising, setCustomising] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Saves are debounced so dragging a colour or typing a reward does not fire
  // a request per keystroke.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const save = useCallback((patch: Record<string, unknown>, immediate = false) => {
    if (timer.current) clearTimeout(timer.current)
    const run = async () => {
      setSaving(true); setError(null)
      try {
        const res = await fetch('/api/owner/program', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) { setError(data.message ?? 'Could not save.'); return }
        // design_version comes back changed when the look changed, which is
        // what makes the preview below refresh instead of showing stale art.
        if (data.program) setProgram((p) => ({ ...p, ...data.program }))
      } catch {
        setError('No connection — your last change was not saved.')
      } finally {
        setSaving(false)
      }
    }
    if (immediate) void run()
    else timer.current = setTimeout(() => void run(), 500)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function set<K extends keyof typeof program>(key: K, value: (typeof program)[K]) {
    setProgram((p) => ({ ...p, [key]: value }))
  }

  async function uploadImage(file: File, kind: 'logo' | 'band' = 'logo') {
    setUploading(true); setError(null)
    try {
      const form = new FormData()
      form.append('logo', file)
      form.append('kind', kind)
      const res = await fetch('/api/owner/logo', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.message ?? 'Could not read that image.'); return }
      setProgram((p) => kind === 'band'
        ? { ...p, band_image_url: data.band_image_url, design_version: p.design_version + 1 }
        : {
            ...p,
            logo_url: data.logo_url,
            bg_color: data.palette.bg,
            fg_color: data.palette.fg,
            label_color: data.palette.label,
            design_version: p.design_version + 1,
          })
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/j/${store.slug}`
    : `/j/${store.slug}`

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-8">
      {/* progress */}
      <div className="flex gap-1.5" aria-hidden>
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${
            i <= step ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
        {saving && <span className="ml-2 opacity-60">saving…</span>}
      </p>

      {/* the card, always visible — it is the thing being decided */}
      {step < 4 && (
        <div className="mt-5">
          <CardPreview
            program={program}
            shopName={shopName || company.name}
            storeName={store.name !== shopName ? store.name : undefined}
            stamps={Math.min(3, program.stamps_required)}
          />
        </div>
      )}

      <div className="mt-7">
        {step === 0 && (
          <Section title="What is your shop called?">
            <input
              value={shopName}
              onChange={(e) => { setShopName(e.target.value); save({ shop_name: e.target.value }) }}
              placeholder="Bubble Tea Co" className={input}
            />
            <p className="mt-5 text-sm font-medium">Your logo</p>
            <p className="mt-1 text-[13px] text-neutral-500">
              We will pull your colours out of it. You can change them after.
            </p>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2
                              rounded-xl border border-dashed border-neutral-300 px-4 py-6
                              text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                     onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f) }} />
              {uploading ? 'Reading your logo…'
                : program.logo_url ? 'Choose a different logo' : 'Upload a logo'}
            </label>
          </Section>
        )}

        {step === 1 && (
          <Section title="Pick a look">
            <div className="grid grid-cols-2 gap-2.5">
              {CARD_STYLES.map((s) => (
                <button key={s.id}
                  onClick={() => { set('card_style', s.id); save({ card_style: s.id }, true) }}
                  className={`rounded-xl border p-3 text-left transition ${
                    program.card_style === s.id
                      ? 'border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-900'
                      : 'border-neutral-200 dark:border-neutral-800'}`}>
                  <span className="block text-sm font-medium">{s.name}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-neutral-500">
                    {s.blurb}
                  </span>
                </button>
              ))}
            </div>

            {program.card_style === 'band' && (
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2
                                rounded-xl border border-dashed border-neutral-300 px-4 py-5
                                text-sm text-neutral-600 dark:border-neutral-700
                                dark:text-neutral-400">
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                       onChange={(e) => { const f = e.target.files?.[0]
                                          if (f) void uploadImage(f, 'band') }} />
                {uploading ? 'Reading your image…'
                  : program.band_image_url ? 'Choose a different image'
                  : 'Upload your band image — until you do, the card shows stamps'}
              </label>
            )}

            <button onClick={() => setCustomising((v) => !v)}
                    className="mt-5 text-sm text-blue-600 hover:underline">
              {customising ? 'Hide' : 'Customise'} colours and stamp
            </button>

            {customising && (
              <div className="mt-4 space-y-4 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
                <div className="flex flex-wrap gap-4">
                  {([['bg_color','Background'],['fg_color','Text'],['label_color','Labels']] as const)
                    .map(([key, label]) => (
                    <label key={key} className="text-[13px]">
                      <span className="block text-neutral-500">{label}</span>
                      <input type="color" value={program[key]}
                        onChange={(e) => { set(key, e.target.value.toUpperCase());
                                           save({ [key]: e.target.value.toUpperCase() }) }}
                        className="mt-1 h-9 w-16 cursor-pointer rounded border-0 bg-transparent p-0" />
                    </label>
                  ))}
                </div>
                {program.card_style === 'stamps' && (
                  <div>
                    <span className="block text-[13px] text-neutral-500">Stamp</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {STAMP_ICONS.map((icon) => (
                        <button key={icon}
                          onClick={() => { set('stamp_icon', icon); save({ stamp_icon: icon }, true) }}
                          className={`rounded-lg border px-2.5 py-1.5 text-[13px] capitalize ${
                            program.stamp_icon === icon
                              ? 'border-neutral-900 dark:border-white'
                              : 'border-neutral-200 dark:border-neutral-700'}`}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {step === 2 && (
          <Section title="What do they get?">
            <div className="flex flex-wrap gap-1.5">
              {REWARD_PRESETS.map((r) => (
                <button key={r}
                  onClick={() => { set('reward_text', r); save({ reward_text: r }, true) }}
                  className={`rounded-lg border px-2.5 py-1.5 text-[13px] ${
                    program.reward_text === r
                      ? 'border-neutral-900 dark:border-white'
                      : 'border-neutral-200 dark:border-neutral-700'}`}>
                  {r}
                </button>
              ))}
            </div>
            <input
              value={program.reward_text} maxLength={REWARD_MAX_LENGTH}
              onChange={(e) => { set('reward_text', e.target.value);
                                 save({ reward_text: e.target.value }) }}
              placeholder="Free boba" className={`${input} mt-3`}
            />
            <p className="mt-1.5 text-[12px] text-neutral-500">
              {REWARD_MAX_LENGTH - program.reward_text.length} characters left — the card is narrow,
              so short wins.
            </p>

            <p className="mt-6 text-sm font-medium">How many stamps to earn it?</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STAMPS_REQUIRED_SUGGESTED.map((n) => (
                <button key={n}
                  onClick={() => { set('stamps_required', n); save({ stamps_required: n }, true) }}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] tabular-nums ${
                    program.stamps_required === n
                      ? 'border-neutral-900 dark:border-white'
                      : 'border-neutral-200 dark:border-neutral-700'}`}>
                  {n}
                </button>
              ))}
              <input type="number" min={STAMPS_REQUIRED_MIN} max={STAMPS_REQUIRED_MAX}
                value={program.stamps_required}
                onChange={(e) => { const n = Number(e.target.value);
                                   set('stamps_required', n); save({ stamps_required: n }) }}
                className="w-20 rounded-lg border border-neutral-200 px-3 py-1.5 text-[13px]
                           tabular-nums dark:border-neutral-700 dark:bg-neutral-900" />
            </div>
            <p className="mt-1.5 text-[12px] text-neutral-500">
              Fewer stamps brings people back sooner. More makes each reward cost you less.
            </p>

            <p className="mt-6 text-sm font-medium">What does one reward cost you?</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-neutral-500">$</span>
              <input
                inputMode="decimal" placeholder="7.00"
                defaultValue={program.reward_value_cents != null
                  ? (program.reward_value_cents / 100).toFixed(2) : ''}
                onChange={(e) => save({ reward_value: e.target.value })}
                className="w-28 rounded-xl border border-neutral-300 px-3 py-2.5 text-base
                           tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-neutral-500">
              Optional, and only you ever see it. It is what turns "61 rewards redeemed"
              into "$427 given away this month".
            </p>
          </Section>
        )}

        {step === 3 && (
          <Section title="A few details" subtitle="All optional — these show on the back of the card.">
            <Labelled label="Address"
              hint="Later this lets the card appear on a customer's lock screen when they are near you.">
              <input value={storeAddress}
                onChange={(e) => { setStoreAddress(e.target.value); save({ address: e.target.value }) }}
                placeholder="1 Dundas St W, Toronto" className={input} />
            </Labelled>
            <Labelled label="Opening hours">
              <input defaultValue={program.back_hours ?? ''}
                onChange={(e) => save({ back_hours: e.target.value })}
                placeholder="Mon–Sun 11am–9pm" className={input} />
            </Labelled>
            <Labelled label="Instagram">
              <input defaultValue={program.back_instagram ?? ''}
                onChange={(e) => save({ back_instagram: e.target.value })}
                placeholder="@bubbleteaco" className={input} />
            </Labelled>
            <Labelled label="Menu link">
              <input defaultValue={program.back_menu_url ?? ''}
                onChange={(e) => save({ back_menu_url: e.target.value })}
                placeholder="https://…" className={input} />
            </Labelled>
          </Section>
        )}

        {step === 4 && (
          <Section title="You are live">
            <p className="text-[15px] text-neutral-600 dark:text-neutral-400">
              This is your counter code. Customers scan it and the card lands in their
              phone — no app, no account.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/print/qr/${store.slug}.png`} alt="Your counter QR code"
                   width={900} height={1200} className="w-full" />
            </div>
            <a href={`/api/print/qr/${store.slug}.png`} target="_blank" rel="noopener"
               className="mt-3 block text-center text-sm text-blue-600 hover:underline">
              Open full size to print
            </a>
            <p className="mt-6 text-[13px] text-neutral-500">Your join page</p>
            <code className="mt-1 block break-all rounded-lg bg-neutral-100 px-3 py-2
                             font-mono text-[12px] dark:bg-neutral-900">{joinUrl}</code>
            <a href={`/j/${store.slug}`} target="_blank" rel="noopener"
               className="mt-4 block rounded-xl bg-neutral-900 px-4 py-3.5 text-center
                          text-base font-semibold text-white dark:bg-white dark:text-neutral-900">
              See what customers see
            </a>
          </Section>
        )}
      </div>

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700
                      dark:bg-red-950/40 dark:text-red-300">{error}</p>
      )}

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)}
            className="rounded-xl border border-neutral-300 px-5 py-3.5 text-base
                       font-medium dark:border-neutral-700">Back</button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-xl bg-neutral-900 px-4 py-3.5 text-base font-semibold
                       text-white dark:bg-white dark:text-neutral-900">
            {step === 3 ? 'Finish' : 'Next'}
          </button>
        )}
      </div>
    </main>
  )
}

const input =
  'mt-1.5 w-full rounded-xl border border-neutral-300 px-4 py-3 text-base ' +
  'focus:border-neutral-900 focus:outline-none ' +
  'dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-400'

function Section(
  { title, subtitle, children }:
  { title: string; subtitle?: string; children: React.ReactNode },
) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-[13px] text-neutral-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Labelled(
  { label, hint, children }: { label: string; hint?: string; children: React.ReactNode },
) {
  return (
    <label className="mt-4 block text-sm font-medium first:mt-0">
      {label}
      {children}
      {hint && <span className="mt-1.5 block text-[12px] font-normal text-neutral-500">{hint}</span>}
    </label>
  )
}
