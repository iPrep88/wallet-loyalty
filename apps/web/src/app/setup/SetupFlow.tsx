'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CARD_TEMPLATES, STAMP_ICONS, STAMP_ICON_LABELS,
  STAMPS_REQUIRED_SUGGESTED, STAMPS_REQUIRED_MIN, STAMPS_REQUIRED_MAX,
} from '@wl/shared/constants'
import { REWARD_PRESETS, REWARD_MAX_LENGTH } from '@wl/shared/rewards'
import { inputClass as input } from '@/components/ui'
import { postForm, postJson, putJson } from '@/lib/post'
import CardPreview, { type PreviewProgram } from './CardPreview'
import OptionCard from './OptionCard'

/**
 * Setting a shop up.
 *
 * Three screens, in the order an owner thinks: what the card looks like, what
 * it takes and gives, and then the code for the counter. It would be shorter
 * to skip the design and hand them a default — but designing the card is what
 * makes it theirs, and an owner who has chosen their own colours is an owner
 * who puts the stand out.
 *
 * The one rule throughout: never make them operate a control to get something
 * reasonable. Every screen has a good answer already filled in.
 */

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

type Program = PreviewProgram & {
  photo_url: string | null
  stamp_icon: string
  reward_value_cents: number | null
  back_hours: string | null
}

type Path = null | 'own' | 'template'

const STEPS = ['Your card', 'Your reward', 'Your code'] as const

export default function SetupFlow({
  company, store, program: initial,
}: {
  company: { name: string; slug: string }
  store: { name: string; slug: string; address: string; showName: boolean }
  program: Program
}) {
  const [step, setStep] = useState(0)
  const [program, setProgram] = useState(initial)
  const [shopName, setShopName] = useState(company.name)
  const [path, setPath] = useState<Path>(initial.logo_url ? 'own' : null)

  const [website, setWebsite] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced, so dragging a colour or typing a reward is one request rather
  // than one per keystroke.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const save = useCallback((patch: Record<string, unknown>, now = false) => {
    if (timer.current) clearTimeout(timer.current)
    const run = async () => {
      setSaving(true); setError(null)
      const result = await putJson<{ program?: Program }>('/api/owner/program', patch)
      setSaving(false)
      if (!result.ok) { setError(result.message); return }
      if (result.data.program) setProgram((p) => ({ ...p, ...result.data.program }))
    }
    if (now) void run()
    else timer.current = setTimeout(() => void run(), 500)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function set<K extends keyof Program>(key: K, value: Program[K]) {
    setProgram((p) => ({ ...p, [key]: value }))
  }

  async function uploadImage(file: File, kind: 'logo' | 'photo' = 'logo') {
    setUploading(true); setError(null)
    const form = new FormData()
    form.append('logo', file)
    form.append('kind', kind)
    const result = await postForm<{
      logo_url?: string; photo_url?: string; applied?: boolean
      palette?: { bg: string; fg: string; label: string }
    }>('/api/owner/logo', form)
    setUploading(false)
    if (!result.ok) { setError(result.message); return }
    const d = result.data
    setProgram((p) => kind === 'photo'
      ? { ...p, photo_url: d.photo_url ?? null, card_style: 'photo',
          design_version: p.design_version + 1 }
      : {
          ...p,
          logo_url: d.logo_url ?? null,
          // Colours only move if the owner has not chosen their own.
          bg_color: d.applied ? d.palette?.bg ?? p.bg_color : p.bg_color,
          fg_color: d.applied ? d.palette?.fg ?? p.fg_color : p.fg_color,
          label_color: d.applied ? d.palette?.label ?? p.label_color : p.label_color,
          design_version: p.design_version + 1,
        })
  }

  async function findBrand() {
    if (!website.trim()) return
    setLooking(true); setError(null)
    const result = await postJson<Lookup>('/api/owner/brand', { url: website })
    setLooking(false)
    if (!result.ok) { setError(result.message); return }
    setLookup(result.data)
    if (result.data.name && !shopName.trim()) {
      setShopName(result.data.name)
      save({ shop_name: result.data.name })
    }
  }

  async function applyOption(o: LookupOption) {
    setSaving(true); setError(null)
    const result = await putJson<{ program?: Program }>('/api/owner/brand', {
      bg_color: o.bg_color, fg_color: o.fg_color, label_color: o.label_color,
      style: o.style,
      logo_url: lookup?.logo_url ?? null,
      photo_url: o.style === 'photo' ? lookup?.photo_url ?? null : null,
    })
    setSaving(false)
    if (!result.ok) { setError(result.message); return }
    if (result.data.program) setProgram((p) => ({ ...p, ...result.data.program }))
  }

  function applyTemplate(t: (typeof CARD_TEMPLATES)[number]) {
    set('bg_color', t.bg); set('fg_color', t.fg); set('label_color', t.label)
    save({ bg_color: t.bg, fg_color: t.fg, label_color: t.label }, true)
  }

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/j/${store.slug}`
    : `/j/${store.slug}`

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-5 py-8">
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

      <div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-12">
        {step < 2 ? (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <CardPreview
              program={program}
              shopName={shopName || company.name}
              storeName={store.showName ? store.name : undefined}
              stamps={Math.min(3, program.stamps_required)}
            />
            <p className="mt-3 hidden text-[12px] leading-snug text-muted lg:block">
              This is your card. It updates as you change things.
            </p>
          </div>
        ) : <div className="hidden lg:block" />}

        <div className="mx-auto w-full max-w-md lg:mx-0">
          {step === 0 && path === null && <ChooseAPath onPick={setPath} shopName={shopName} />}

          {step === 0 && path === 'own' && (
            <OwnDesign
              program={program} shopName={shopName} setShopName={setShopName}
              website={website} setWebsite={setWebsite}
              looking={looking} uploading={uploading}
              lookup={lookup}
              onFind={() => void findBrand()}
              onUpload={(f) => void uploadImage(f)}
              onOption={(o) => void applyOption(o)}
              onTemplate={applyTemplate}
              onColor={(k, v) => { set(k, v); save({ [k]: v }) }}
              onBack={() => { setPath(null); setLookup(null) }}
              onSaveName={(v) => save({ shop_name: v })}
            />
          )}

          {step === 0 && path === 'template' && (
            <UseTemplate
              program={program} shopName={shopName} setShopName={setShopName}
              uploading={uploading}
              onUpload={(f) => void uploadImage(f)}
              onTemplate={applyTemplate}
              onBack={() => setPath(null)}
              onSaveName={(v) => save({ shop_name: v })}
            />
          )}

          {step === 1 && (
            <TheDeal program={program} set={set} save={save} />
          )}

          {step === 2 && (
            <YourCode storeSlug={store.slug} joinUrl={joinUrl} />
          )}

          {error && (
            <p className="mt-5 rounded-xl border border-red-300/50 bg-red-500/10 px-4 py-3
                          text-sm text-red-700 dark:text-red-200">{error}</p>
          )}

          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-line px-5 py-3.5 text-base font-medium">
                Back
              </button>
            )}
            {step < STEPS.length - 1 && path !== null && (
              <button onClick={() => setStep((s) => s + 1)}
                className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-base font-semibold
                           text-accent-ink">
                {step === 1 ? 'Get my code' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------- step one */

function ChooseAPath({ onPick, shopName }: { onPick: (p: Path) => void; shopName: string }) {
  return (
    <Section title="How should your card look?">
      <div className="space-y-3">
        <button onClick={() => onPick('own')}
          className="w-full rounded-2xl border border-line p-4 text-left transition-colors
                     hover:border-accent">
          <span className="block text-[15px] font-bold">Design my own</span>
          <span className="mt-1 block text-[13px] leading-snug text-muted">
            Start from your logo. We read your colours out of it and build the card
            around them — you can change anything after.
          </span>
        </button>

        <button onClick={() => onPick('template')}
          className="w-full rounded-2xl border border-line p-4 text-left transition-colors
                     hover:border-accent">
          <span className="block text-[15px] font-bold">Use a ready-made card</span>
          <span className="mt-1 block text-[13px] leading-snug text-muted">
            Pick one of six and you are done. Add your logo if you have one.
          </span>
          <span className="mt-3 flex gap-1.5">
            {CARD_TEMPLATES.map((t) => (
              <span key={t.id} className="flex h-9 flex-1 items-center justify-center
                                          rounded-md text-[8px] font-bold ring-1 ring-black/10"
                    style={{ backgroundColor: t.bg, color: t.fg }}>
                {(shopName || 'SHOP').slice(0, 3).toUpperCase()}
              </span>
            ))}
          </span>
        </button>
      </div>
    </Section>
  )
}

function ShopName(
  { shopName, setShopName, onSaveName }:
  { shopName: string; setShopName: (v: string) => void; onSaveName: (v: string) => void },
) {
  return (
    <>
      <p className="mt-6 text-sm font-semibold">Your shop name</p>
      <input value={shopName} placeholder="Bubble Tea Co" className={input}
             onChange={(e) => { setShopName(e.target.value); onSaveName(e.target.value) }} />
      <p className="mt-1.5 text-[12.5px] text-muted">
        Customers see this on their card, so use the name on your sign.
      </p>
    </>
  )
}

function OwnDesign(props: {
  program: Program
  shopName: string
  setShopName: (v: string) => void
  onSaveName: (v: string) => void
  website: string
  setWebsite: (v: string) => void
  looking: boolean; uploading: boolean
  lookup: Lookup | null
  onFind: () => void
  onUpload: (f: File) => void
  onOption: (o: LookupOption) => void
  onTemplate: (t: (typeof CARD_TEMPLATES)[number]) => void
  onColor: (k: 'bg_color' | 'fg_color' | 'label_color', v: string) => void
  onBack: () => void
}) {
  const { program, lookup } = props
  return (
    <Section title="Your logo"
             subtitle="We read your colours out of it and keep your logo readable on the card.">
      <label className="flex cursor-pointer items-center justify-center rounded-xl border
                        border-dashed border-line px-4 py-7 text-sm text-muted
                        transition-colors hover:border-accent">
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
               className="hidden"
               onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onUpload(f) }} />
        {props.uploading ? 'Reading your logo…'
          : program.logo_url ? 'Use a different logo' : 'Upload your logo'}
      </label>

      {/* Secondary on purpose. It is a shortcut that works most of the time,
          not a route to depend on — if it misses, the owner has lost nothing
          because the upload above is the real path. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] text-link">
          Or paste your website and we will find it
        </summary>
        <div className="mt-2.5 flex gap-2">
          <input value={props.website} placeholder="yourshop.ca"
                 inputMode="url" autoCapitalize="off" className={`${input} flex-1`}
                 onChange={(e) => props.setWebsite(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') props.onFind() }} />
          <button onClick={props.onFind} disabled={props.looking || !props.website.trim()}
            className="mt-1.5 flex-none rounded-xl bg-accent px-4 text-[14px] font-semibold
                       text-accent-ink disabled:opacity-45">
            {props.looking ? 'Looking…' : 'Find'}
          </button>
        </div>
      </details>

      {lookup && lookup.options.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold">
            {lookup.found_brand ? 'Built from your website' : 'We could not find a logo there'}
          </p>
          <p className="mt-1 text-[12.5px] text-muted">
            {lookup.found_brand
              ? 'Pick one, or carry on below.'
              : 'These are our colours. Upload your logo above and we will use yours.'}
          </p>
          <div className="mt-3 space-y-3">
            {lookup.options.map((o) => (
              <OptionCard key={o.id} name={o.name} blurb={o.blurb}
                bg={o.bg_color} fg={o.fg_color} label={o.label_color}
                shopName={props.shopName} photoUrl={lookup.photo_url}
                isPhoto={o.style === 'photo'}
                selected={program.bg_color.toUpperCase() === o.bg_color.toUpperCase()}
                onSelect={() => props.onOption(o)} />
            ))}
          </div>
        </div>
      )}

      <Colours program={program} onColor={props.onColor} onTemplate={props.onTemplate} />
      <ShopName shopName={props.shopName} setShopName={props.setShopName}
                onSaveName={props.onSaveName} />

      <button onClick={props.onBack} className="mt-6 text-sm text-link hover:underline">
        Use a ready-made card instead
      </button>
    </Section>
  )
}

function UseTemplate(props: {
  program: Program
  shopName: string
  setShopName: (v: string) => void
  onSaveName: (v: string) => void
  uploading: boolean
  onUpload: (f: File) => void
  onTemplate: (t: (typeof CARD_TEMPLATES)[number]) => void
  onBack: () => void
}) {
  return (
    <Section title="Pick a card">
      <div className="grid grid-cols-2 gap-2.5">
        {CARD_TEMPLATES.map((t) => {
          const chosen = props.program.bg_color.toUpperCase() === t.bg
          return (
            <button key={t.id} onClick={() => props.onTemplate(t)}
              className={`overflow-hidden rounded-xl border text-left transition-colors ${
                chosen ? 'border-accent' : 'border-line hover:border-faint'}`}>
              <span className="flex h-16 items-center justify-center"
                    style={{ backgroundColor: t.bg, color: t.fg }}>
                <span className="truncate px-2 text-[12px] font-bold tracking-[0.1em]">
                  {(props.shopName || 'Your shop').toUpperCase()}
                </span>
              </span>
              <span className="block px-2.5 py-2 text-[12px] font-semibold">{t.name}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-6 text-sm font-semibold">Add your logo</p>
      <p className="mt-1 text-[12.5px] text-muted">
        Optional. Your shop name shows on the card either way.
      </p>
      <label className="mt-2.5 flex cursor-pointer items-center justify-center rounded-xl
                        border border-dashed border-line px-4 py-5 text-sm text-muted
                        transition-colors hover:border-accent">
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
               className="hidden"
               onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onUpload(f) }} />
        {props.uploading ? 'Reading your logo…'
          : props.program.logo_url ? 'Use a different logo' : 'Upload a logo'}
      </label>

      <ShopName shopName={props.shopName} setShopName={props.setShopName}
                onSaveName={props.onSaveName} />

      <button onClick={props.onBack} className="mt-6 text-sm text-link hover:underline">
        Design my own instead
      </button>
    </Section>
  )
}

function Colours(
  { program, onColor, onTemplate }: {
    program: Program
    onColor: (k: 'bg_color' | 'fg_color' | 'label_color', v: string) => void
    onTemplate: (t: (typeof CARD_TEMPLATES)[number]) => void
  },
) {
  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-sm font-semibold">
        Colours <span className="font-normal text-muted">— change if you want to</span>
      </summary>
      <div className="mt-3 space-y-4 rounded-xl bg-surface-2 p-4">
        <div className="flex flex-wrap gap-4">
          {([['bg_color', 'Card'], ['fg_color', 'Marks'], ['label_color', 'Labels']] as const)
            .map(([key, label]) => (
            <label key={key} className="text-[13px]">
              <span className="block text-muted">{label}</span>
              <input type="color" value={program[key]}
                onChange={(e) => onColor(key, e.target.value.toUpperCase())}
                className="mt-1 h-9 w-16 cursor-pointer rounded border-0 bg-transparent p-0" />
            </label>
          ))}
        </div>
        <div>
          <span className="block text-[12.5px] text-muted">Or start from one of ours</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CARD_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => onTemplate(t)} title={t.name}
                className="size-9 rounded-lg ring-1 ring-black/10"
                style={{ backgroundColor: t.bg }} aria-label={t.name} />
            ))}
          </div>
        </div>
      </div>
    </details>
  )
}

/* ------------------------------------------------------------- step two */

function TheDeal(
  { program, set, save }: {
    program: Program
    set: <K extends keyof Program>(k: K, v: Program[K]) => void
    save: (patch: Record<string, unknown>, now?: boolean) => void
  },
) {
  return (
    <Section title="Your reward" subtitle="What customers collect, and what they get for it.">
      <p className="text-sm font-semibold">The stamp</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {STAMP_ICONS.map((icon) => (
          <button key={icon}
            onClick={() => { set('stamp_icon', icon); save({ stamp_icon: icon }, true) }}
            className={`rounded-lg border px-2 py-2 text-[12.5px] transition-colors ${
              program.stamp_icon === icon
                ? 'border-accent bg-accent-soft font-semibold'
                : 'border-line text-muted hover:border-faint'}`}>
            {STAMP_ICON_LABELS[icon]}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm font-semibold">How many to earn a reward</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {STAMPS_REQUIRED_SUGGESTED.map((n) => (
          <button key={n}
            onClick={() => { set('stamps_required', n); save({ stamps_required: n }, true) }}
            className={`rounded-lg border px-3.5 py-2 text-[13px] tabular transition-colors ${
              program.stamps_required === n
                ? 'border-accent bg-accent-soft font-semibold'
                : 'border-line text-muted hover:border-faint'}`}>
            {n}
          </button>
        ))}
        <input type="number" min={STAMPS_REQUIRED_MIN} max={STAMPS_REQUIRED_MAX}
          value={program.stamps_required}
          onChange={(e) => { const n = Number(e.target.value)
                             set('stamps_required', n); save({ stamps_required: n }) }}
          className="w-20 rounded-lg border border-line bg-surface-2 px-3 py-2
                     text-[13px] tabular" />
      </div>
      <p className="mt-1.5 text-[12.5px] text-muted">
        Fewer brings people back sooner. More makes each reward cost you less.
      </p>

      <p className="mt-6 text-sm font-semibold">What they get</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REWARD_PRESETS.map((r) => (
          <button key={r}
            onClick={() => { set('reward_text', r); save({ reward_text: r }, true) }}
            className={`rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors ${
              program.reward_text === r
                ? 'border-accent bg-accent-soft font-semibold'
                : 'border-line text-muted hover:border-faint'}`}>
            {r}
          </button>
        ))}
      </div>
      <input value={program.reward_text} maxLength={REWARD_MAX_LENGTH} placeholder="Free boba"
        onChange={(e) => { set('reward_text', e.target.value)
                           save({ reward_text: e.target.value }) }}
        className={`${input} mt-2.5`} />
      <p className="mt-1.5 text-[12.5px] text-muted">
        {REWARD_MAX_LENGTH - program.reward_text.length} characters left — the card is
        narrow, so short wins.
      </p>

      <p className="mt-6 text-sm font-semibold">What one reward costs you</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-muted">$</span>
        <input inputMode="decimal" placeholder="7.00"
          defaultValue={program.reward_value_cents != null
            ? (program.reward_value_cents / 100).toFixed(2) : ''}
          onChange={(e) => save({ reward_value: e.target.value })}
          className="w-28 rounded-xl border border-line bg-surface-2 px-3 py-2.5
                     text-base tabular" />
      </div>
      <p className="mt-1.5 text-[12.5px] text-muted">
        Optional, and only you see it. It turns &ldquo;61 rewards redeemed&rdquo; into
        &ldquo;$427 given away&rdquo;.
      </p>
    </Section>
  )
}

/* ----------------------------------------------------------- step three */

function YourCode({ storeSlug, joinUrl }: { storeSlug: string; joinUrl: string }) {
  return (
    <Section title="You are live"
             subtitle="Print this and put it where customers can see it. They scan, the card lands in their phone — no app, no account.">
      <div className="overflow-hidden rounded-2xl border border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/print/qr/${storeSlug}.png`} alt="Your counter code"
             width={900} height={1200} className="w-full" />
      </div>
      <a href={`/api/print/qr/${storeSlug}.png`} target="_blank" rel="noopener"
         className="mt-3 block text-center text-sm text-link hover:underline">
        Open full size to print
      </a>

      <p className="mt-6 text-[13px] text-muted">Your join page</p>
      <code className="mt-1 block break-all rounded-lg bg-surface-2 px-3 py-2
                       font-mono text-[12px]">{joinUrl}</code>

      <div className="mt-5 flex flex-col gap-2.5">
        <a href={`/j/${storeSlug}`} target="_blank" rel="noopener"
           className="rounded-xl bg-accent px-4 py-3.5 text-center text-base font-semibold
                      text-accent-ink">
          See what customers see
        </a>
        <a href="/dashboard"
           className="rounded-xl border border-line px-4 py-3.5 text-center text-base
                      font-medium">
          Go to my dashboard
        </a>
      </div>
    </Section>
  )
}

function Section(
  { title, subtitle, children }:
  { title: string; subtitle?: string; children: React.ReactNode },
) {
  return (
    <section>
      <h2 className="text-lg font-bold tracking-[-0.015em]">{title}</h2>
      {subtitle && <p className="mt-1.5 text-[13px] leading-snug text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
