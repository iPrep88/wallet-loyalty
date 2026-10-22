'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
// Leaf imports, not the barrel: the barrel re-exports token signing, which
// pulls node:crypto into whatever bundle touches it — and this is a client
// component.
import {
  CARD_STYLES, STAMP_ICONS, CARD_TEMPLATES,
  STAMPS_REQUIRED_SUGGESTED, STAMPS_REQUIRED_MIN, STAMPS_REQUIRED_MAX,
} from '@wl/shared/constants'
import { REWARD_PRESETS, REWARD_MAX_LENGTH } from '@wl/shared/rewards'
import { inputClass as input } from '@/components/ui'
import { postForm, postJson } from '@/lib/post'
import CardPreview, { type PreviewProgram } from './CardPreview'
import OptionCard from './OptionCard'

interface Props {
  company: { name: string; slug: string }
  store: { name: string; slug: string; address: string; showName: boolean }
  program: PreviewProgram & {
    photo_url: string | null
    stamp_icon: string
    reward_value_cents: number | null
    back_hours: string | null
    back_instagram: string | null
    back_menu_url: string | null
  }
}

const STEPS = ['Your shop', 'Your card', 'The deal', 'Details', 'Done'] as const

type Path = null | 'ready' | 'own'

interface LookupOption {
  id: string; name: string; blurb: string
  style: 'minimal' | 'photo'
  bg_color: string; fg_color: string; label_color: string
}
interface Lookup {
  site_url: string
  name: string | null
  found_brand: boolean
  logo_url: string | null
  photo_url: string | null
  options: LookupOption[]
}

export default function SetupFlow({ company, store, program: initial }: Props) {
  const [step, setStep] = useState(0)
  const [program, setProgram] = useState(initial)
  const [shopName, setShopName] = useState(company.name)
  const [storeAddress, setStoreAddress] = useState(store.address)
  const [customising, setCustomising] = useState(false)
  // null until they choose; a logo already uploaded means they chose 'own'.
  const [path, setPath] = useState<Path>(initial.logo_url ? 'own' : null)
  const [website, setWebsite] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
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
      const result = await postJson<{ program?: typeof initial }>(
        '/api/owner/program', patch,
      )
      setSaving(false)
      if (!result.ok) { setError(result.message); return }
      // design_version comes back changed when the look changed, which is what
      // makes the preview below refresh instead of showing stale artwork.
      if (result.data.program) setProgram((p) => ({ ...p, ...result.data.program }))
    }
    if (immediate) void run()
    else timer.current = setTimeout(() => void run(), 500)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function set<K extends keyof typeof program>(key: K, value: (typeof program)[K]) {
    setProgram((p) => ({ ...p, [key]: value }))
  }

  /**
   * "Paste your website and we will build your card."
   *
   * Fetches their own site, finds the logo and colours, and comes back with
   * finished cards. The owner never operates a colour picker to get here.
   */
  async function findBrand() {
    if (!website.trim()) return
    setLooking(true); setError(null)
    const result = await postJson<Lookup>('/api/owner/brand', { url: website })
    setLooking(false)
    if (!result.ok) { setError(result.message); return }
    setLookup(result.data)
    setPath('own')
    if (result.data.name && !shopName.trim()) {
      setShopName(result.data.name)
      save({ shop_name: result.data.name })
    }
    setStep(1)
  }

  async function applyOption(o: LookupOption) {
    setChosen(o.id); setSaving(true); setError(null)
    const result = await postJson<{ program?: typeof initial }>('/api/owner/brand', {
      bg_color: o.bg_color, fg_color: o.fg_color, label_color: o.label_color,
      style: o.style,
      logo_url: lookup?.logo_url ?? null,
      photo_url: o.style === 'photo' ? lookup?.photo_url ?? null : null,
    }, 'PUT')
    setSaving(false)
    if (!result.ok) { setError(result.message); return }
    if (result.data.program) setProgram((p) => ({ ...p, ...result.data.program }))
  }

  async function uploadImage(file: File, kind: 'logo' | 'photo' = 'logo') {
    setUploading(true); setError(null)
    const form = new FormData()
    form.append('logo', file)
    form.append('kind', kind)
    const result = await postForm<{
      logo_url?: string; photo_url?: string
      palette?: { bg: string; fg: string; label: string }
    }>('/api/owner/logo', form)
    setUploading(false)
    if (!result.ok) { setError(result.message); return }
    const data = result.data
    setProgram((p) => kind === 'photo'
      ? { ...p, photo_url: data.photo_url ?? null, card_style: 'photo',
          design_version: p.design_version + 1 }
      : {
          ...p,
          logo_url: data.logo_url ?? null,
          bg_color: data.palette?.bg ?? p.bg_color,
          fg_color: data.palette?.fg ?? p.fg_color,
          label_color: data.palette?.label ?? p.label_color,
          design_version: p.design_version + 1,
        })
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
            i <= step ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
        {saving && <span className="ml-2 opacity-60">saving…</span>}
      </p>

      {/* the card, always visible — it is the thing being decided */}
      {step < 4 && (
        <div className="mt-5">
          <CardPreview
            program={program}
            shopName={shopName || company.name}
            storeName={store.showName ? store.name : undefined}
            stamps={Math.min(3, program.stamps_required)}
          />
        </div>
      )}

      <div className="mt-7">
        {step === 0 && (
          <Section title="Let us build your card"
                   subtitle="Paste your website and we will find your logo and colours. No website is fine too.">
            <div className="flex gap-2">
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void findBrand() }}
                placeholder="yourshop.ca" inputMode="url" autoCapitalize="off"
                className={`${input} flex-1`}
              />
              <button onClick={() => void findBrand()} disabled={looking || !website.trim()}
                className="mt-1.5 flex-none rounded-xl bg-accent px-4 text-[14px] font-semibold
                           text-accent-ink transition-colors disabled:opacity-45">
                {looking ? 'Looking…' : 'Find'}
              </button>
            </div>

            <p className="mt-6 text-sm font-semibold">What is your shop called?</p>
            <input
              value={shopName}
              onChange={(e) => { setShopName(e.target.value); save({ shop_name: e.target.value }) }}
              placeholder="Bubble Tea Co" className={input}
            />
            <p className="mt-1.5 text-[12.5px] text-muted">
              Customers see this on their card, so use the name on your sign.
            </p>
          </Section>
        )}

        {step === 1 && lookup && lookup.options.length > 0 && (
          <Section title={lookup.found_brand ? 'Built from your website' : 'Pick a card'}
                   subtitle={lookup.found_brand
                     ? 'Pick one. You can change any of it afterwards.'
                     : `We could not find a logo on ${lookup.site_url}, so these are ours. Upload a logo below and we will rebuild them around it.`}>
            <div className="space-y-3">
              {lookup.options.map((o) => (
                <OptionCard key={o.id}
                  name={o.name} blurb={o.blurb}
                  bg={o.bg_color} fg={o.fg_color} label={o.label_color}
                  shopName={shopName}
                  photoUrl={lookup.photo_url}
                  isPhoto={o.style === 'photo'}
                  selected={chosen === o.id}
                  onSelect={() => void applyOption(o)} />
              ))}
            </div>

            <button onClick={() => { setLookup(null); setPath(null) }}
                    className="mt-5 text-sm text-link hover:underline">
              None of these — let me start over
            </button>
          </Section>
        )}

        {step === 1 && !lookup && path === null && (
          <Section title="How should your card look?">
            <div className="space-y-3">
              <button onClick={() => setPath('ready')}
                className="w-full rounded-2xl border border-line p-4 text-left
                           transition hover:border-accent
                           dark:hover:border-white">
                <span className="block text-[15px] font-semibold">Use a ready-made design</span>
                <span className="mt-1 block text-[13px] leading-snug text-muted">
                  Pick one of six and you are done. Your shop name goes on the front, so
                  customers can tell it from every other card in their wallet.
                </span>
                <div className="mt-3 flex gap-1.5">
                  {CARD_TEMPLATES.map((t) => (
                    <span key={t.id} className="h-7 flex-1 rounded-md ring-1 ring-black/10"
                          style={{ backgroundColor: t.bg }} />
                  ))}
                </div>
              </button>

              <button onClick={() => setPath('own')}
                className="w-full rounded-2xl border border-line p-4 text-left
                           transition hover:border-accent
                           dark:hover:border-white">
                <span className="block text-[15px] font-semibold">Design it myself</span>
                <span className="mt-1 block text-[13px] leading-snug text-muted">
                  Upload your logo and we build the card around it. You can change any
                  colour afterwards.
                </span>
              </button>
            </div>
          </Section>
        )}

        {step === 1 && path === 'ready' && (
          <Section title="Pick a card">
            <div className="grid grid-cols-2 gap-2.5">
              {CARD_TEMPLATES.map((t) => {
                const chosen = program.bg_color.toUpperCase() === t.bg
                return (
                  <button key={t.id}
                    onClick={() => {
                      set('bg_color', t.bg); set('fg_color', t.fg); set('label_color', t.label)
                      save({ bg_color: t.bg, fg_color: t.fg, label_color: t.label }, true)
                    }}
                    className={`overflow-hidden rounded-xl border text-left transition ${
                      chosen ? 'border-accent'
                             : 'border-line'}`}>
                    <span className="flex h-16 items-center justify-center"
                          style={{ backgroundColor: t.bg, color: t.fg }}>
                      <span className="text-[13px] font-semibold">{shopName || 'Your shop'}</span>
                    </span>
                    <span className="block px-2.5 py-2 text-[12px] font-medium">{t.name}</span>
                  </button>
                )
              })}
            </div>
            <ModePicker program={program} set={set} save={save}
                        onPhoto={(f) => void uploadImage(f, 'photo')}
                        uploading={uploading} />
            <button onClick={() => setPath(null)}
                    className="mt-5 text-sm text-link hover:underline">
              Back to the two options
            </button>
          </Section>
        )}

        {step === 1 && path === 'own' && (
          <Section title="Your logo"
                   subtitle="We read your colours out of it and build the card so your logo stays visible.">
            <label className="flex cursor-pointer items-center justify-center gap-2
                              rounded-xl border border-dashed border-line px-4 py-6
                              text-sm text-muted">
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                     onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f) }} />
              {uploading ? 'Reading your logo…'
                : program.logo_url ? 'Choose a different logo' : 'Upload a logo'}
            </label>

            <ModePicker program={program} set={set} save={save}
                        onPhoto={(f) => void uploadImage(f, 'photo')}
                        uploading={uploading} />

            <button onClick={() => setCustomising((v) => !v)}
                    className="mt-5 text-sm text-link hover:underline">
              {customising ? 'Hide' : 'Change'} the colours
            </button>

            {customising && (
              <div className="mt-4 space-y-4 rounded-xl bg-surface-2 p-4">
                <div className="flex flex-wrap gap-4">
                  {([['bg_color','Card'],['fg_color','Text'],['label_color','Labels']] as const)
                    .map(([key, label]) => (
                    <label key={key} className="text-[13px]">
                      <span className="block text-muted">{label}</span>
                      <input type="color" value={program[key]}
                        onChange={(e) => { set(key, e.target.value.toUpperCase())
                                           save({ [key]: e.target.value.toUpperCase() }) }}
                        className="mt-1 h-9 w-16 cursor-pointer rounded border-0 bg-transparent p-0" />
                    </label>
                  ))}
                </div>
                <p className="text-[12px] text-muted">
                  Or start from a ready-made one —{' '}
                  <button onClick={() => setPath('ready')} className="text-link hover:underline">
                    see the six
                  </button>.
                </p>
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
                      ? 'border-accent'
                      : 'border-line'}`}>
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
            <p className="mt-1.5 text-[12px] text-muted">
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
                      ? 'border-accent'
                      : 'border-line'}`}>
                  {n}
                </button>
              ))}
              <input type="number" min={STAMPS_REQUIRED_MIN} max={STAMPS_REQUIRED_MAX}
                value={program.stamps_required}
                onChange={(e) => { const n = Number(e.target.value);
                                   set('stamps_required', n); save({ stamps_required: n }) }}
                className="w-20 rounded-lg border border-line px-3 py-1.5 text-[13px]
                           tabular-nums" />
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              Fewer stamps brings people back sooner. More makes each reward cost you less.
            </p>

            <p className="mt-6 text-sm font-medium">What does one reward cost you?</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted">$</span>
              <input
                inputMode="decimal" placeholder="7.00"
                defaultValue={program.reward_value_cents != null
                  ? (program.reward_value_cents / 100).toFixed(2) : ''}
                onChange={(e) => save({ reward_value: e.target.value })}
                className="w-28 rounded-xl border border-line px-3 py-2.5 text-base
                           tabular-nums"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
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
            <p className="text-[15px] text-muted">
              This is your counter code. Customers scan it and the card lands in their
              phone — no app, no account.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/print/qr/${store.slug}.png`} alt="Your counter QR code"
                   width={900} height={1200} className="w-full" />
            </div>
            <a href={`/api/print/qr/${store.slug}.png`} target="_blank" rel="noopener"
               className="mt-3 block text-center text-sm text-link hover:underline">
              Open full size to print
            </a>
            <p className="mt-6 text-[13px] text-muted">Your join page</p>
            <code className="mt-1 block break-all rounded-lg bg-surface-2 px-3 py-2
                             font-mono text-[12px]">{joinUrl}</code>
            <a href={`/j/${store.slug}`} target="_blank" rel="noopener"
               className="mt-4 block rounded-xl bg-accent px-4 py-3.5 text-center
                          text-base font-semibold text-accent-ink">
              See what customers see
            </a>
          </Section>
        )}
      </div>

      {error && (
        <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200
                      dark:bg-red-950/40 dark:text-red-300">{error}</p>
      )}

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)}
            className="rounded-xl border border-line px-5 py-3.5 text-base
                       font-medium">Back</button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-base font-semibold
                       text-accent-ink">
            {step === 3 ? 'Finish' : 'Next'}
          </button>
        )}
      </div>
    </main>
  )
}


function ModePicker(
  { program, set, save, onPhoto, uploading }: {
    program: { card_style: string; stamp_icon: string; photo_url: string | null }
    set: (k: never, v: never) => void
    save: (patch: Record<string, unknown>, immediate?: boolean) => void
    onPhoto: (file: File) => void
    uploading: boolean
  },
) {
  const put = set as unknown as (k: string, v: string) => void
  return (
    <>
      <p className="mt-6 text-sm font-semibold">Card style</p>
      <div className="mt-2 space-y-2">
        {CARD_STYLES.map((st) => {
          const soon = 'comingSoon' in st && st.comingSoon
          const chosen = program.card_style === st.id
          return (
            <button key={st.id} disabled={soon}
              onClick={() => { if (soon) return; put('card_style', st.id)
                               save({ card_style: st.id }, true) }}
              className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                soon ? 'border-line opacity-45'
                : chosen ? 'border-accent bg-accent-soft'
                : 'border-line hover:border-faint'}`}>
              <span className="flex items-center gap-2 text-[14px] font-semibold">
                {st.name}
                {soon && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase
                                   tracking-wider text-faint">soon</span>
                )}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">
                {st.blurb}
              </span>
            </button>
          )
        })}
      </div>

      {program.card_style === 'photo' && (
        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl
                          border border-dashed border-line px-4 py-5 text-[13.5px] text-muted">
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f) }} />
          {uploading ? 'Reading your photo…'
            : program.photo_url ? 'Use a different photo'
            : 'Add a photo — we handle the crop'}
        </label>
      )}

      <p className="mt-5 text-sm font-semibold">Stamp mark</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {STAMP_ICONS.map((icon) => (
          <button key={icon}
            onClick={() => { put('stamp_icon', icon); save({ stamp_icon: icon }, true) }}
            className={`rounded-lg border px-2.5 py-1.5 text-[13px] capitalize transition-colors ${
              program.stamp_icon === icon
                ? 'border-accent bg-accent-soft font-semibold'
                : 'border-line text-muted hover:border-faint'}`}>
            {icon}
          </button>
        ))}
      </div>
    </>
  )
}

function Section(
  { title, subtitle, children }:
  { title: string; subtitle?: string; children: React.ReactNode },
) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
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
      {hint && <span className="mt-1.5 block text-[12px] font-normal text-muted">{hint}</span>}
    </label>
  )
}
