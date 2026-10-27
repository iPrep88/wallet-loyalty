import Link from 'next/link'
import { BRAND } from './_brand'
import { AddToWallet, FakeQr, Phone, PhotoSlot, StatusBar, WalletCard } from './_marketing'
import { MARK } from '@wl/shared/mark'

export const metadata = {
  title: 'REPIO — Loyalty cards that live in the wallet',
  description:
    'Loyalty cards built into Apple Wallet and Google Wallet. No app, no account, '
  + 'just more repeat customers.',
}

/**
 * The page a shop owner lands on.
 *
 * Fixed palette rather than the app's theme-reactive tokens: this is one
 * designed thing and should look identical to everybody, where the tool behind
 * the login is something people work in all day and should follow their system.
 */
export default function Landing() {
  return (
    <div style={{ background: BRAND.white, color: BRAND.ink }}>
      <Nav />
      <Hero />
      <HowItWorks />
      <Dashboard />
      <Examples />
      <Proof />
      <Closer />
      <Footer />
    </div>
  )
}

const CONTAINER = 'mx-auto w-full max-w-[1080px] px-6'

/* ------------------------------------------------------------------ mark */

/** The r, beside the name. Same geometry as the favicon and the signature
 *  drawn into every customer's card — one logo, cut three ways. */
function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={MARK.viewBox} fill="none" aria-hidden>
      <path d={MARK.arm} stroke="currentColor" strokeWidth={MARK.armWidth}
            strokeLinecap="round" />
      <circle cx={MARK.dot.cx} cy={MARK.dot.cy} r={MARK.dot.r} fill="currentColor" />
    </svg>
  )
}

/* ------------------------------------------------------------------- nav */
function Nav() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className={`${CONTAINER} flex h-[72px] items-center justify-between gap-6`}>
        <span className="inline-flex items-center gap-2.5" style={{ color: BRAND.white }}>
          <Mark size={26} />
          <span className="text-[15px] font-bold tracking-[0.3em]">REPIO</span>
        </span>
        <nav className="hidden items-center gap-8 text-[13.5px] font-medium md:flex"
             style={{ color: 'rgba(232,244,255,.72)' }}>
          {['Features', 'Pricing', 'Examples', 'Resources'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="transition-colors hover:text-white">
              {item}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-[13.5px] font-medium transition-colors hover:text-white"
                style={{ color: 'rgba(232,244,255,.72)' }}>
            Log in
          </Link>
          <Link href="/signup"
                className="rounded-full px-4 py-2 text-[13.5px] font-semibold transition-transform
                           hover:scale-[1.03]"
                style={{ background: BRAND.brightBlue, color: BRAND.midnight }}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ hero */
function Hero() {
  return (
    <section className="relative overflow-hidden pt-[72px]"
             style={{ background: BRAND.midnight }}>
      {/* A single soft light source behind the phones, so the panel is lit
          rather than filled. */}
      <div className="pointer-events-none absolute right-[-10%] top-[-18%] h-[620px] w-[620px]
                      rounded-full opacity-[0.55]"
           style={{ background:
             `radial-gradient(circle, ${BRAND.navy} 0%, rgba(18,50,77,0) 68%)` }} />

      <div className={`${CONTAINER} relative grid items-center gap-12 pb-20 pt-14
                       lg:grid-cols-[1fr_minmax(0,460px)] lg:pb-24 lg:pt-20`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]"
             style={{ color: 'rgba(139,200,255,.75)' }}>
            Loyalty, built for modern businesses
          </p>
          <h1 className="mt-5 text-[clamp(2.6rem,7.5vw,4.1rem)] font-extrabold
                         leading-[0.98] tracking-[-0.035em]"
              style={{ color: BRAND.white }}>
            Make <span style={{ color: BRAND.iceBlue }}>them</span><br />
            come <span style={{ color: BRAND.iceBlue }}>back.</span>
          </h1>
          <p className="mt-6 max-w-[27rem] text-[16.5px] leading-[1.65]"
             style={{ color: 'rgba(232,244,255,.7)' }}>
            Beautiful loyalty cards built directly into Apple Wallet and Google Wallet.
            No app. No account. Just more repeat customers.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/signup"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px]
                             font-semibold transition-transform hover:scale-[1.03]"
                  style={{ background: BRAND.brightBlue, color: BRAND.midnight }}>
              Get started <span aria-hidden>→</span>
            </Link>
            <a href="#how" className="inline-flex items-center gap-2.5 text-[14.5px] font-medium"
               style={{ color: 'rgba(232,244,255,.85)' }}>
              See how it works
              <span className="flex size-7 items-center justify-center rounded-full"
                    style={{ border: '1px solid rgba(232,244,255,.3)' }} aria-hidden>
                <svg width="8" height="9" viewBox="0 0 8 9" fill="none">
                  <path d="M0 0.5L8 4.5L0 8.5V0.5Z" fill="rgba(232,244,255,.85)" />
                </svg>
              </span>
            </a>
          </div>

          {/* Three things that are true today. There were three invented
              numbers here — businesses onboarded, visits tracked, a lift in
              repeat customers — and a shop owner checks that sort of claim. */}
          <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-6">
            {[
              ['$9.99', 'Per location, per month'],
              ['No app', 'Nothing for your customers to download'],
              ['No card', 'First month free, no payment details'],
            ].map(([value, label]) => (
              <div key={label} className="max-w-[9.5rem]">
                <dt className="text-[26px] font-extrabold tracking-[-0.03em] tabular"
                    style={{ color: BRAND.iceBlue }}>{value}</dt>
                <dd className="mt-1 text-[12px] leading-snug"
                    style={{ color: 'rgba(232,244,255,.55)' }}>{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <HeroPhones />
      </div>
    </section>
  )
}

function HeroPhones() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="relative pb-6 pr-[22%] pt-4">
        <Phone className="w-full">
          <StatusBar />
          <div className="px-3.5 pb-5 pt-2">
            <WalletCard
              name="MAISON" tagline="COFFEE & PATISSERIE"
              art="/examples/hero-maison.png"
              bg="#F4EFE6" fg="#14110D" muted="#6B6256"
              stamps={6} required={10}
              caption="4 visits until a free drink"
            />
            <div className="mt-4 rounded-[14px] p-3" style={{ background: BRAND.white }}>
              <div className="flex justify-center"><FakeQr size={104} seed={5} /></div>
              <p className="mt-2 text-center text-[9.5px] font-medium" style={{ color: '#6B7280' }}>
                Show to staff
              </p>
            </div>
            <div className="mt-3 flex justify-center"><AddToWallet kind="apple" /></div>
          </div>
        </Phone>
      </div>

      {/* The second phone sits behind and lower, so the pair reads as depth
          rather than as two of the same thing. */}
      <div className="absolute bottom-0 right-0 w-[58%] translate-y-[14%]">
        <Phone>
          <StatusBar />
          <div className="px-3 pb-4 pt-1.5">
            <WalletCard
              name="SORA" tagline="JAPANESE CUISINE"
              art="/examples/hero-sora.png"
              bg="#0E1113" fg="#EDE6DA" muted="#8C8578"
              stamps={3} required={10}
              reward="Free appetiser"
            />
            <div className="mt-3 flex justify-center"><AddToWallet kind="google" /></div>
          </div>
        </Phone>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- how it works */
function HowItWorks() {
  const steps = [
    { n: 1, title: 'Customer scans',
      body: 'Your customer scans a QR code at your business.', art: <CounterArt /> },
    { n: 2, title: 'Add to Wallet',
      body: 'Their loyalty card is instantly added to Apple Wallet or Google Wallet.',
      art: <AddArt /> },
    { n: 3, title: 'They come back',
      body: 'They return, you scan, and they earn rewards.', art: <LockScreenArt /> },
  ]

  return (
    <section id="how" className="py-20 sm:py-24" style={{ background: BRAND.snow }}>
      <div className={CONTAINER}>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em]"
           style={{ color: BRAND.slate }}>How it works</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-end">
          <h2 className="text-[clamp(1.9rem,4.4vw,2.6rem)] font-extrabold leading-[1.1]
                         tracking-[-0.03em]">
            Simple for you.<br />Seamless for your customers.
          </h2>
          <p className="text-[15px] leading-[1.65]" style={{ color: BRAND.slate }}>
            Get started in minutes and give your customers a beautiful loyalty card
            they&rsquo;ll always have with them — in their Wallet.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n}>
              <div className="overflow-hidden rounded-2xl"
                   style={{ border: `1px solid ${BRAND.border}` }}>{s.art}</div>
              <div className="mt-5 flex items-start gap-3">
                <span className="mt-[1px] flex size-[22px] flex-none items-center justify-center
                                 rounded-full text-[11px] font-bold"
                      style={{ background: BRAND.paleIce, color: BRAND.navy }}>{s.n}</span>
                <div>
                  <h3 className="text-[16px] font-bold tracking-[-0.01em]">{s.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-[1.6]" style={{ color: BRAND.slate }}>
                    {s.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function CounterArt() {
  return (
    <PhotoSlot label="counter-stand" className="flex aspect-[4/3] items-center justify-center">
      <div className="rounded-[10px] px-4 pb-4 pt-3.5 shadow-xl"
           style={{ background: '#F4EFE6' }}>
        <div className="text-center text-[9px] font-bold tracking-[0.2em]"
             style={{ color: '#14110D' }}>MAISON</div>
        <div className="mt-0.5 text-center text-[5.5px] font-semibold tracking-[0.16em]"
             style={{ color: '#6B6256' }}>COFFEE &amp; PATISSERIE</div>
        <div className="mt-2.5 flex justify-center"><FakeQr size={72} dark="#14110D"
             light="#F4EFE6" seed={11} /></div>
        <div className="mt-2 text-center text-[6px] font-medium" style={{ color: '#6B6256' }}>
          Join our loyalty card
        </div>
      </div>
    </PhotoSlot>
  )
}

function AddArt() {
  return (
    <PhotoSlot label="add-to-wallet" className="flex aspect-[4/3] items-end justify-center pt-7">
      <div className="w-[62%]">
        <Phone>
          <StatusBar />
          <div className="px-2.5 pb-7 pt-1">
            <WalletCard name="MAISON" tagline="COFFEE & PATISSERIE"
                        art="/examples/maison.png" bg="#F4EFE6" fg="#14110D" muted="#6B6256"
                        stamps={8} required={10} />
            <div className="mt-2.5 flex justify-center"><AddToWallet kind="apple" /></div>
          </div>
        </Phone>
      </div>
    </PhotoSlot>
  )
}

function LockScreenArt() {
  return (
    <PhotoSlot label="lock-screen" className="flex aspect-[4/3] items-end justify-center pt-7">
      <div className="w-[62%]">
        <Phone>
          <StatusBar />
          <div className="px-3 pb-7 pt-4 text-center">
            <p className="text-[8px] font-medium" style={{ color: 'rgba(255,255,255,.6)' }}>
              Monday, June 10
            </p>
            <p className="text-[34px] font-semibold leading-none tracking-[-0.03em]"
               style={{ color: BRAND.white }}>9:41</p>
            <div className="mt-5 rounded-[11px] px-2.5 py-2 text-left backdrop-blur"
                 style={{ background: 'rgba(255,255,255,.14)' }}>
              <p className="text-[7px] font-bold tracking-[0.1em]"
                 style={{ color: 'rgba(255,255,255,.75)' }}>MAISON</p>
              <p className="mt-0.5 text-[8px] leading-snug" style={{ color: BRAND.white }}>
                You&rsquo;re 1 visit away from a free drink.
              </p>
            </div>
          </div>
        </Phone>
      </div>
    </PhotoSlot>
  )
}

/* ------------------------------------------------------------- dashboard */
function Dashboard() {
  return (
    <section id="features" className="py-20 sm:py-24" style={{ background: '#EFF2F6' }}>
      <div className={`${CONTAINER} grid items-center gap-12 lg:grid-cols-[minmax(0,22rem)_1fr]`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]"
             style={{ color: BRAND.slate }}>Your business, in focus</p>
          <h2 className="mt-4 text-[clamp(1.9rem,4.4vw,2.5rem)] font-extrabold leading-[1.1]
                         tracking-[-0.03em]">
            Track visits.<br />Understand your customers.<br />Grow faster.
          </h2>
          <p className="mt-5 text-[15px] leading-[1.65]" style={{ color: BRAND.slate }}>
            See your customer activity, measure repeat visits, and learn what keeps your
            customers coming back — all in one clean dashboard.
          </p>
          <Link href="/signup"
                className="mt-7 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14.5px]
                           font-semibold transition-transform hover:scale-[1.03]"
                style={{ background: BRAND.brightBlue, color: BRAND.midnight }}>
            Get started <span aria-hidden>→</span>
          </Link>
        </div>
        <DashboardMock />
      </div>
    </section>
  )
}

function DashboardMock() {
  const tiles = [
    ['1,284', 'Total customers', '+12%'],
    ['67%', 'Repeat customers', '+8%'],
    ['4.2', 'Visits per customer', '+10%'],
    ['312', 'Rewards redeemed', '+24%'],
  ]
  const nav = ['Overview', 'Customers', 'Loyalty Cards', 'Analytics', 'Settings']

  return (
    <div className="overflow-hidden rounded-2xl"
         style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`,
                  boxShadow: '0 30px 60px -35px rgba(11,27,43,.35)' }}>
      <div className="flex items-center justify-between px-5 py-3.5"
           style={{ borderBottom: `1px solid ${BRAND.border}` }}>
        <span className="text-[11px] font-bold tracking-[0.28em]">REPIO</span>
        <span className="size-5 rounded-full" style={{ background: BRAND.paleIce }} />
      </div>
      <div className="grid gap-0 sm:grid-cols-[136px_1fr]">
        <aside className="hidden flex-col gap-0.5 p-3 sm:flex"
               style={{ borderRight: `1px solid ${BRAND.border}` }}>
          {nav.map((n, i) => (
            <span key={n} className="rounded-md px-2.5 py-1.5 text-[11.5px] font-medium"
                  style={i === 0
                    ? { background: BRAND.paleIce, color: BRAND.navy, fontWeight: 600 }
                    : { color: BRAND.slate }}>
              {n}
            </span>
          ))}
        </aside>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold tracking-[-0.01em]">Overview</h3>
            <span className="rounded-md px-2 py-1 text-[10.5px] font-medium"
                  style={{ border: `1px solid ${BRAND.border}`, color: BRAND.slate }}>
              Last 30 days
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {tiles.map(([value, label, delta]) => (
              <div key={label} className="rounded-xl p-3"
                   style={{ border: `1px solid ${BRAND.border}` }}>
                <div className="text-[19px] font-extrabold tracking-[-0.03em] tabular">{value}</div>
                <div className="mt-0.5 text-[10px]" style={{ color: BRAND.slate }}>{label}</div>
                <div className="mt-1.5 text-[10px] font-semibold"
                     style={{ color: '#2F7D52' }}>{delta}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl p-3.5" style={{ border: `1px solid ${BRAND.border}` }}>
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold">Customer visits</span>
              <span className="text-[10px]" style={{ color: BRAND.slate }}>Monthly</span>
            </div>
            <VisitsChart />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Illustrative line — shaped like a plausible year, not read from anything. */
function VisitsChart() {
  const points = [320, 300, 420, 390, 560, 540, 700, 760, 820, 900, 980, 1120]
  const W = 520, H = 92, PAD = 4
  const max = Math.max(...points) * 1.08
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (points.length - 1)
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2)
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`

  return (
    <div className="mt-2.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label="Customer visits rising over twelve months">
        <defs>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={BRAND.brightBlue} stopOpacity="0.22" />
            <stop offset="1" stopColor={BRAND.brightBlue} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f}
                stroke={BRAND.border} strokeWidth="1" />
        ))}
        <path d={area} fill="url(#fade)" />
        <path d={line} fill="none" stroke={BRAND.brightBlue} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1]!)} r="3.5"
                fill={BRAND.brightBlue} stroke={BRAND.white} strokeWidth="2" />
      </svg>
      <div className="mt-1 flex justify-between text-[8.5px]" style={{ color: BRAND.slate }}>
        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- examples */
function Examples() {
  const cards = [
    { slug: 'maison', name: 'MAISON', tagline: 'COFFEE & PATISSERIE',
      bg: '#F4EFE6', fg: '#14110D', muted: '#6B6256', stamps: 6 },
    { slug: 'sora', name: 'SORA', tagline: 'JAPANESE CUISINE',
      bg: '#0E1113', fg: '#EDE6DA', muted: '#8C8578', stamps: 3 },
    { slug: 'blush', name: 'BLUSH', tagline: 'BOBA & TEA',
      bg: '#F2D4DC', fg: '#3A1E28', muted: '#8A6472', stamps: 7 },
    { slug: 'north', name: 'NORTH & CO.', tagline: 'COFFEE ROASTERS',
      bg: '#14271E', fg: '#DDE8DF', muted: '#86A292', stamps: 7 },
    { slug: 'elio', name: 'ELIO', tagline: 'ITALIAN KITCHEN',
      bg: '#16130F', fg: '#F0E6D6', muted: '#948878', stamps: 7 },
  ]

  return (
    <section id="examples" className="py-20 sm:py-24" style={{ background: BRAND.snow }}>
      <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[minmax(0,19rem)_1fr] lg:items-center`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]"
             style={{ color: BRAND.slate }}>Your brand, your style</p>
          <h2 className="mt-4 text-[clamp(1.9rem,4.4vw,2.5rem)] font-extrabold leading-[1.1]
                         tracking-[-0.03em]">
            Beautiful cards for every business.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.65]" style={{ color: BRAND.slate }}>
            Give us your logo and we build the card around it — your colours, your name,
            composed for you. No design work, and nothing to get wrong.
          </p>
          <Link href="/signup"
                className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14.5px]
                           font-semibold transition-transform hover:scale-[1.03]"
                style={{ background: BRAND.brightBlue, color: BRAND.midnight }}>
            Browse templates <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Scrolls on a phone rather than cramming five cards into 375px. */}
        <div className="-mx-6 overflow-x-auto px-6 pb-2 lg:mx-0 lg:px-0">
          <div className="flex gap-3.5" style={{ minWidth: 'min-content' }}>
            {cards.map((c) => (
              <div key={c.slug} className="w-[178px] flex-none">
                <WalletCard name={c.name} tagline={c.tagline}
                            art={`/examples/${c.slug}.png`}
                            bg={c.bg} fg={c.fg} muted={c.muted}
                            stamps={c.stamps} required={10} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- proof */

/**
 * What used to be here: a testimonial from a café owner who does not exist,
 * and two invented retention figures.
 *
 * Being new is not a thing to paper over. A shop owner who is told the truth
 * and offered the owner's phone number is a better prospect than one who
 * later works out the quote was made up.
 */
function Proof() {
  return (
    <section className="relative overflow-hidden" style={{ background: BRAND.midnight }}>
      <PhotoSlot label="interior-wide" className="absolute inset-0" />
      <div className="absolute inset-0"
           style={{ background:
             `linear-gradient(90deg, ${BRAND.midnight} 12%, rgba(6,21,37,.72) 55%, rgba(6,21,37,.9) 100%)` }} />

      <div className={`${CONTAINER} relative grid gap-10 py-20 sm:py-24
                       lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-center`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]"
             style={{ color: 'rgba(139,200,255,.75)' }}>Early access</p>
          <h2 className="mt-4 text-[clamp(1.7rem,4vw,2.2rem)] font-extrabold leading-[1.12]
                         tracking-[-0.03em]" style={{ color: BRAND.white }}>
            New here.<br />Looking for our first shops.
          </h2>
          <p className="mt-4 text-[14.5px] leading-[1.65]"
             style={{ color: 'rgba(232,244,255,.62)' }}>
            Repio is built and running in Toronto. We are signing up the first
            independent cafés, bakeries and bubble tea shops now — so you would be
            early, and you would be talking to the person who built it.
          </p>
          <Link href="/signup"
                className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14.5px]
                           font-semibold transition-transform hover:scale-[1.03]"
                style={{ background: BRAND.brightBlue, color: BRAND.midnight }}>
            Get started <span aria-hidden>→</span>
          </Link>
        </div>

        <ul className="space-y-4 text-[14.5px] leading-snug lg:max-w-[22rem]"
            style={{ color: 'rgba(232,244,255,.78)' }}>
          {[
            'Your card, in your colours, built from your logo',
            'Nothing for your customers to install',
            'One code on the counter — they scan, and they are in',
            'Cancel whenever. Your customer list leaves with you',
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden className="mt-[0.45em] size-1.5 flex-none rounded-full"
                    style={{ background: BRAND.brightBlue }} />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- closer */
function Closer() {
  return (
    <section id="pricing" className="py-20 sm:py-24" style={{ background: BRAND.white }}>
      <div className={`${CONTAINER} text-center`}>
        <h2 className="mx-auto max-w-[20ch] text-[clamp(2rem,5vw,2.9rem)] font-extrabold
                       leading-[1.08] tracking-[-0.035em]">
          Give us your logo.<br />We&rsquo;ll handle the rest.
        </h2>
        <p className="mx-auto mt-5 max-w-[34rem] text-[16px] leading-[1.65]"
           style={{ color: BRAND.slate }}>
          Set up in five minutes, free for your first month, and no card required to start.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup"
                className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15.5px]
                           font-semibold transition-transform hover:scale-[1.03]"
                style={{ background: BRAND.midnight, color: BRAND.white }}>
            Get started <span aria-hidden>→</span>
          </Link>
          <Link href="/login" className="text-[14.5px] font-semibold"
                style={{ color: BRAND.navy }}>
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{ background: BRAND.midnight }}>
      <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-5 py-10`}>
        <span className="inline-flex items-center gap-2.5" style={{ color: BRAND.white }}>
          <Mark size={22} />
          <span className="text-[13px] font-bold tracking-[0.3em]">REPIO</span>
        </span>
        <nav className="flex flex-wrap gap-6 text-[12.5px]"
             style={{ color: 'rgba(232,244,255,.55)' }}>
          {['Features', 'Pricing', 'Examples', 'Privacy', 'Terms'].map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-white">{l}</a>
          ))}
        </nav>
        <span className="text-[12px]" style={{ color: 'rgba(232,244,255,.4)' }}>
          © {new Date().getFullYear()} REPIO
        </span>
      </div>
    </footer>
  )
}
