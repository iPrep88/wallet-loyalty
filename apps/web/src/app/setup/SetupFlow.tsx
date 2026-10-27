'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CARD_TEMPLATES, STAMP_ICONS, STAMP_ICON_LABELS,
  STAMPS_REQUIRED_MIN, STAMPS_REQUIRED_MAX,
} from '@wl/shared/constants'
import { REWARD_PRESETS, REWARD_MAX_LENGTH, dealLine, cardBoxes } from '@wl/shared/rewards'
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

/** Box counts an owner actually prints. Boxes, not visits — the number they
 *  are choosing is the one anybody can count on the card. */
const BOX_CHOICES = [6, 8, 10, 12] as const

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

  // Step one has a screen inside a screen: the two paths, and then the one
  // they picked. Back has to walk out of the inner screen before it walks out
  // of the step, or the other half of the choice is only reachable by a text
  // link at the bottom that nobody scrolls to.
  const canGoBack = step > 0 || (step === 0 && path !== null)
  function goBack() {
    if (step === 0) { setPath(null); setLookup(null); return }
    setStep((s) => s - 1)
  }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-5 py-6 sm:py-8">
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
          /* Pinned on a phone too. Every control on these screens changes
             this card, and a preview you have to scroll back up to is a
             preview nobody looks at. */
          <div className="sticky top-0 z-20 -mx-5 bg-page px-5 pb-3 pt-2
                          lg:top-6 lg:z-auto lg:mx-0 lg:self-start
                          lg:px-0 lg:pb-0 lg:pt-0">
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
          {canGoBack && <BackButton onClick={goBack} />}

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
              onSaveName={(v) => save({ shop_name: v })}
            />
          )}

          {step === 0 && path === 'template' && (
            <UseTemplate
              program={program} shopName={shopName} setShopName={setShopName}
              uploading={uploading}
              onUpload={(f) => void uploadImage(f)}
              onTemplate={applyTemplate}
              onSaveName={(v) => save({ shop_name: v })}
            />
          )}

          {step === 1 && (
            <TheDeal program={program} set={set} save={save} />
          )}

          {step === 2 && (
            <YourCode storeSlug={store.slug} shopName={shopName || company.name}
                      joinUrl={joinUrl} />
          )}

          {error && (
            <p className="mt-5 rounded-xl border border-red-300/50 bg-red-500/10 px-4 py-3
                          text-sm text-red-700 dark:text-red-200">{error}</p>
          )}

          {step < STEPS.length - 1 && path !== null && (
            <button onClick={() => setStep((s) => s + 1)}
              className="mt-8 w-full rounded-xl bg-accent px-4 py-3.5 text-base font-semibold
                         text-accent-ink">
              {step === 1 ? 'Get my code' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

/**
 * The way out of wherever you are.
 *
 * Above the content, not under it: on a phone the bottom of a screen is three
 * scrolls away, and a back control you have to go looking for is one nobody
 * uses — which is how the other half of a two-way choice ends up invisible.
 */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="-ml-2 mb-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5
                 text-[13.5px] font-medium text-muted transition-colors
                 hover:bg-surface-2 hover:text-ink">
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path d="M9.5 3 4.5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  )
}

/** A field that cannot be left blank. */
function Req() {
  return <span className="ml-0.5 text-red-500" aria-label="required">*</span>
}

/** A field that can. */
function Optional() {
  return <span className="ml-1.5 text-[11.5px] font-normal text-faint">Optional</span>
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
      <p className="mt-6 text-sm font-semibold">Your shop name<Req /></p>
      <input value={shopName} placeholder="Bubble Tea Co" className={input}
             onChange={(e) => { setShopName(e.target.value); onSaveName(e.target.value) }} />
      <p className="mt-1.5 text-[12.5px] text-muted">
        It runs across the top of the card beside your logo, and across the top of
        your counter stand. Use the name on your sign.
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

      <FromWebsite website={props.website} setWebsite={props.setWebsite}
                   looking={props.looking} onFind={props.onFind} />

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
    </Section>
  )
}

/**
 * Pulling the brand off their own website.
 *
 * A panel of its own, open, rather than a disclosure triangle. It is still a
 * shortcut and not a route to depend on — if it misses, the owner has lost
 * nothing, because the upload above it is the real path. But hiding the best
 * trick we have behind a twisty arrow made it look like a footnote.
 */
function FromWebsite(
  { website, setWebsite, looking, onFind }: {
    website: string; setWebsite: (v: string) => void
    looking: boolean; onFind: () => void
  },
) {
  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3.5">
      <p className="text-[13.5px] font-semibold">Have a website?</p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
        Paste it and we will pull your logo and your colours straight off it.
      </p>
      <div className="mt-2.5 flex gap-2">
        <input value={website} placeholder="yourshop.ca"
               inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
               className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5
                          text-[14.5px] text-ink placeholder:text-faint transition-colors
                          hover:border-faint focus:border-accent focus:outline-none"
               onChange={(e) => setWebsite(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') onFind() }} />
        <button onClick={onFind} disabled={looking || !website.trim()}
          className="flex-none rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold
                     text-accent-ink transition-opacity disabled:opacity-40">
          {looking ? 'Looking…' : 'Find'}
        </button>
      </div>
    </div>
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

      <p className="mt-6 text-sm font-semibold">Add your logo<Optional /></p>
      <p className="mt-1 text-[12.5px] text-muted">
        Your shop name shows on the card either way.
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
    </Section>
  )
}

/**
 * Colours.
 *
 * Open, in a panel of its own. Picking a palette is the part owners enjoy and
 * the part that makes the card feel like theirs — burying it under a
 * disclosure arrow saved forty pixels and cost the one interaction worth
 * having.
 */
function Colours(
  { program, onColor, onTemplate }: {
    program: Program
    onColor: (k: 'bg_color' | 'fg_color' | 'label_color', v: string) => void
    onTemplate: (t: (typeof CARD_TEMPLATES)[number]) => void
  },
) {
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold">
        Colours<span className="ml-1.5 font-normal text-muted">— change any of these</span>
      </p>
      <div className="mt-2.5 rounded-xl border border-line bg-surface-2 p-4">
        <span className="block text-[12.5px] text-muted">Start from one of ours</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARD_TEMPLATES.map((t) => {
            const chosen = program.bg_color.toUpperCase() === t.bg
            return (
              <button key={t.id} onClick={() => onTemplate(t)} title={t.name}
                className={`size-10 rounded-lg transition-shadow ${
                  chosen ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface-2'
                         : 'ring-1 ring-black/10 hover:ring-faint'}`}
                style={{ backgroundColor: t.bg }} aria-label={t.name} />
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-5 border-t border-line pt-4">
          {([['bg_color', 'Card'], ['fg_color', 'Marks'], ['label_color', 'Labels']] as const)
            .map(([key, label]) => (
            <label key={key} className="text-[12.5px]">
              <span className="block text-muted">{label}</span>
              <span className="mt-1.5 flex items-center gap-2">
                <input type="color" value={program[key]}
                  onChange={(e) => onColor(key, e.target.value.toUpperCase())}
                  className="size-9 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                <span className="font-mono text-[11px] tabular text-faint">{program[key]}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- step two */

/**
 * The two shapes a stamp card comes in.
 *
 * Both take exactly the same number of paid visits. The only difference is
 * whether the last box is another stamp or the prize — and that difference is
 * the whole reason "buy 9, get the 10th free" is a sentence everybody already
 * understands, while "collect 10 stamps" has to be explained at the counter.
 */
function CardShape(
  { boxes, rewardInGrid, onPick }: {
    boxes: number; rewardInGrid: boolean
    onPick: (rewardInGrid: boolean) => void
  },
) {
  const options = [
    { value: true, title: `Buy ${boxes - 1}, get the ${boxes}th free`,
      blurb: 'The last box holds the prize, like a paper punch card.' },
    { value: false, title: `Collect ${boxes} stamps`,
      blurb: 'Every box is a stamp. The reward comes after the last one.' },
  ]
  return (
    <div className="space-y-2.5">
      {options.map((o) => {
        const chosen = rewardInGrid === o.value
        return (
          <button key={String(o.value)} onClick={() => onPick(o.value)}
            className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
              chosen ? 'border-accent bg-accent-soft' : 'border-line hover:border-faint'}`}>
            <span className="block text-[14px] font-semibold">{o.title}</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">
              {o.blurb}
            </span>
            <MiniGrid boxes={boxes} rewardInGrid={o.value} />
          </button>
        )
      })}
    </div>
  )
}

/** The row of boxes, small — the shape of the deal without words. */
function MiniGrid({ boxes, rewardInGrid }: { boxes: number; rewardInGrid: boolean }) {
  const slots = Array.from({ length: Math.min(boxes, 12) })
  return (
    <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {slots.map((_, i) => (
        rewardInGrid && i === slots.length - 1 ? (
          <svg key={i} viewBox="0 0 100 100" className="size-4 text-accent" aria-hidden>
            <path d="M5 30h90v20H5zM14 54h72v40H14zM50 30C41 28 29 23 29 14s12-9 21 16zM50 30C59 28 71 23 71 14s-12-9-21 16z"
                  fill="currentColor" fillRule="evenodd" />
          </svg>
        ) : (
          <span key={i} className="size-3 rounded-full border-[1.5px] border-faint" />
        )
      ))}
    </span>
  )
}

function TheDeal(
  { program, set, save }: {
    program: Program
    set: <K extends keyof Program>(k: K, v: Program[K]) => void
    save: (patch: Record<string, unknown>, now?: boolean) => void
  },
) {
  const boxes = cardBoxes(program.stamps_required, program.reward_in_grid)
  const percentReward = /%/.test(program.reward_text)

  /** The owner picks boxes — the thing anybody can count on the card. How many
   *  visits it takes falls out of which shape they chose. */
  function setBoxes(next: number, rewardInGrid = program.reward_in_grid) {
    const required = rewardInGrid ? next - 1 : next
    if (!Number.isFinite(required)) return
    if (required < STAMPS_REQUIRED_MIN || required > STAMPS_REQUIRED_MAX) return
    set('stamps_required', required)
    set('reward_in_grid', rewardInGrid)
    save({ stamps_required: required, reward_in_grid: rewardInGrid }, true)
  }

  return (
    <Section title="Your reward" subtitle="What customers collect, and what they get for it.">
      <p className="text-sm font-semibold">How the card works<Req /></p>
      <div className="mt-2">
        <CardShape boxes={boxes} rewardInGrid={program.reward_in_grid}
                   onPick={(v) => setBoxes(boxes, v)} />
      </div>

      <p className="mt-6 text-sm font-semibold">Boxes on the card<Req /></p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {BOX_CHOICES.map((n) => (
          <button key={n} onClick={() => setBoxes(n)}
            className={`rounded-lg border px-3.5 py-2 text-[13px] tabular transition-colors ${
              boxes === n
                ? 'border-accent bg-accent-soft font-semibold'
                : 'border-line text-muted hover:border-faint'}`}>
            {n}
          </button>
        ))}
        <input type="number"
          min={program.reward_in_grid ? STAMPS_REQUIRED_MIN + 1 : STAMPS_REQUIRED_MIN}
          max={program.reward_in_grid ? STAMPS_REQUIRED_MAX + 1 : STAMPS_REQUIRED_MAX}
          value={boxes}
          onChange={(e) => setBoxes(Number(e.target.value))}
          className="w-20 rounded-lg border border-line bg-surface-2 px-3 py-2
                     text-[13px] tabular" />
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
        {dealLine(program.stamps_required, program.reward_in_grid)} — {program.stamps_required}
        {' '}paid visits either way. Fewer brings people back sooner; more makes each
        reward cost you less.
      </p>

      <p className="mt-6 text-sm font-semibold">The stamp<Req /></p>
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

      <p className="mt-6 text-sm font-semibold">What they get<Req /></p>
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

      <p className="mt-6 text-sm font-semibold">What one reward costs you<Optional /></p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-muted">$</span>
        <input inputMode="decimal" placeholder="7.00"
          defaultValue={program.reward_value_cents != null
            ? (program.reward_value_cents / 100).toFixed(2) : ''}
          onChange={(e) => save({ reward_value: e.target.value })}
          className="w-28 rounded-xl border border-line bg-surface-2 px-3 py-2.5
                     text-base tabular" />
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
        {percentReward
          // Say this plainly rather than let an owner trust a number we cannot
          // stand behind: we do not see the till, so a percentage off is an
          // average at best until a POS tells us what the bill was.
          ? <>A percentage off depends on the bill, and we do not see the bill — so put
              in what it usually works out to, or leave it blank. It only changes the
              dollar figure on your dashboard; no customer sees it.</>
          : <>Only you see it. It turns &ldquo;61 rewards redeemed&rdquo; into
              &ldquo;$427 given away&rdquo;.</>}
      </p>
    </Section>
  )
}

/* ----------------------------------------------------------- step three */

interface StaffRow { id: string; name: string }

/**
 * The last screen, and the one that decides whether a shop ever uses this.
 *
 * An owner leaves here with three things or they leave with nothing: the code
 * for the counter, the code their staff type into the scanner, and a plain
 * account of what happens when a customer walks up. Everything before this
 * screen is decoration if nobody at the till knows what to do.
 */
function YourCode(
  { storeSlug, shopName, joinUrl }:
  { storeSlug: string; shopName: string; joinUrl: string },
) {
  const src = `/api/print/qr/${storeSlug}.png`
  // A filename an owner can still find in their Downloads folder two days later.
  const filename = `${
    shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shop'
  }-stamp-card-code.png`

  const [pin, setPin] = useState<string | null>(null)
  const [existing, setExisting] = useState<StaffRow[] | null>(null)
  const asked = useRef(false)

  // A shop that signs up has no staff and therefore no way to scan anything.
  // Make the owner one the moment they land here, so they never meet a
  // scanner that will not let them in.
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    void (async () => {
      const list = await fetch('/api/owner/staff')
        .then((r) => r.json() as Promise<{ staff?: StaffRow[] }>)
        .catch(() => null)
      // Must not be a silent [] on failure: that would mint a second owner
      // code every time this screen was revisited.
      if (!list || !Array.isArray(list.staff)) { setExisting([]); return }
      const staff = list.staff
      if (staff.length > 0) { setExisting(staff); return }
      const made = await postJson<{ pin?: string }>('/api/owner/staff', { name: 'Owner' })
      if (made.ok && made.data.pin) setPin(made.data.pin)
      else setExisting([])
    })()
  }, [])

  return (
    <Section title="You are live"
             subtitle="Print the code, put it where customers can see it, and you are open. They scan, the card lands in their phone — no app, no account.">
      <div className="overflow-hidden rounded-2xl border border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Your counter code" width={900} height={1200} className="w-full" />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {/* Same origin, so `download` saves the full 900x1200 file rather than
            opening it in a tab — one tap, on a phone as well as a laptop. */}
        <a href={src} download={filename}
           className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl
                      bg-accent px-4 py-3 text-[14.5px] font-semibold text-accent-ink">
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
            <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 16h12"
                  fill="none" stroke="currentColor" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download to print
        </a>
        <a href={src} target="_blank" rel="noopener"
           className="inline-flex flex-1 items-center justify-center rounded-xl border
                      border-line px-4 py-3 text-[14.5px] font-medium text-muted
                      transition-colors hover:bg-surface-2 hover:text-ink">
          Open full size
        </a>
      </div>
      <p className="mt-2 text-center text-[12px] text-faint">
        900 × 1200 — sharp printed at postcard size.
      </p>

      <StaffCode pin={pin} existing={existing} />

      <AtTheCounter storeSlug={storeSlug} />

      <p className="mt-7 text-[13px] text-muted">Your join page</p>
      <code className="mt-1 block break-all rounded-lg bg-surface-2 px-3 py-2
                       font-mono text-[12px]">{joinUrl}</code>

      <div className="mt-5 flex flex-col gap-2.5">
        <a href={`/j/${storeSlug}`} target="_blank" rel="noopener"
           className="rounded-xl border border-line px-4 py-3.5 text-center text-base
                      font-medium">
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

/**
 * The counter code.
 *
 * Shown once and never again, because only its hash is kept. Saying so
 * plainly beats letting an owner discover it when they come back looking.
 */
function StaffCode({ pin, existing }: { pin: string | null; existing: StaffRow[] | null }) {
  if (pin) {
    return (
      <div className="mt-7 rounded-xl border border-accent bg-accent-soft p-4">
        <p className="text-sm font-semibold">Your staff code</p>
        <p className="mt-2 text-center font-mono text-[40px] font-bold leading-none
                      tracking-[0.2em]">{pin}</p>
        <p className="mt-3 text-[12.5px] leading-snug text-muted">
          Write this down now — we store it scrambled and cannot show it to you
          again. If you lose it, make a new one from your dashboard in a second.
        </p>
      </div>
    )
  }
  if (existing && existing.length > 0) {
    return (
      <div className="mt-7 rounded-xl border border-line bg-surface-2 p-4">
        <p className="text-sm font-semibold">Your staff codes</p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
          {existing.length === 1 ? 'One person' : `${existing.length} people`} can
          already sign into the scanner: {existing.map((s) => s.name).join(', ')}.
          Add or reset codes from your dashboard.
        </p>
      </div>
    )
  }
  return null
}

/** What happens when somebody walks up to the till. */
function AtTheCounter({ storeSlug }: { storeSlug: string }) {
  const steps = [
    <>Open the scanner on the shop&rsquo;s phone or tablet and type your staff
      code once. It stays signed in.</>,
    <>A customer shows you their card. Point the camera at their code.</>,
    <>Tap <strong>Add stamp</strong>. Got it wrong? You have 30 seconds to
      undo it.</>,
    <>When their card is full, that button becomes <strong>Redeem</strong>{' '}
      instead. Tap it as you hand over the free one.</>,
  ]
  return (
    <div className="mt-7">
      <p className="text-sm font-semibold">At the counter</p>
      <ol className="mt-2.5 space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[13.5px] leading-snug">
            <span className="flex size-5 flex-none items-center justify-center rounded-full
                             bg-surface-2 text-[11px] font-bold tabular text-muted">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {/* The owner is at a laptop; the scanner has to end up on the phone that
          lives at the till. Nobody types a URL with a query string into a
          phone keyboard, so this is the bridge. */}
      <div className="mt-4 flex gap-4 rounded-xl border border-line bg-surface-2 p-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/print/scanner/${storeSlug}.png`} alt=""
             width={120} height={120}
             className="size-[108px] flex-none rounded-lg bg-white p-1.5" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold">Get it onto the counter phone</p>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">
            Scan this with the phone or tablet that will live at your till. It
            opens the scanner, and from there you can add it to the home screen
            so it works like any other app.
          </p>
          <a href={`/scan?store=${storeSlug}`} target="_blank" rel="noopener"
             className="mt-2 inline-block text-[13px] font-semibold text-link hover:underline">
            Or open it here →
          </a>
        </div>
      </div>
    </div>
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
