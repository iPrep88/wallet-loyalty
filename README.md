# Wallet Loyalty

Digital stamp cards for small shops, living in Apple Wallet and Google Wallet.
Customers never download an app or make an account.

**This is the foundation build.** The whole stamp loop works — joining,
scanning, stamping, cooldown, undo, redeeming, the card artwork. What is *not*
here is delivery into an actual wallet, because that needs paid developer
accounts we do not have yet. See [Not built yet](#not-built-yet).

---

## Running it on a Mac

One-time setup:

```bash
brew install postgresql@17 pnpm && brew services start postgresql@17 && createdb wallet_loyalty
```

Then, in the project folder:

```bash
cp .env.example .env
```

Open `.env` and fill in `QR_TOKEN_SECRET` and `SESSION_SECRET` with long random
strings. This generates both:

```bash
echo "QR_TOKEN_SECRET=$(openssl rand -hex 32)"; echo "SESSION_SECRET=$(openssl rand -hex 32)"
```

Then:

```bash
pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev
```

Open http://localhost:3000 — it lists the demo shop with links to its join page
and its scanner.

**Demo shop:** Bubble Tea Co · staff PINs `1234` (Amy) and `5678` (Ken).

### Trying the loop by hand

1. Open the **join page** → "Get my card". You get one stamp for joining.
2. Expand "Card token (for testing)" and copy the token. In a real shop this
   is the QR on the card; until the wallets are wired up, copying it is how you
   get it to the scanner.
3. Open the **scanner**, sign in with PIN `1234`, paste the token into
   "Or paste a card token", and stamp.

The scanner's camera works in Chrome. Safari does not support the browser
barcode API, so there the token field is the way in.

---

## What works

| | |
|---|---|
| Join | Creates a member, grants the join bonus, issues a signed card token |
| Rejoining | Same phone number returns the same card, never a duplicate |
| Scan | Resolves a token to a member, refusing other shops' cards |
| Stamp | With a quantity stepper, a server-side cooldown, and overfill reporting |
| Redeem | Only at a full card; banks the reward and resets the count |
| Undo | 30 seconds, only by the staff member who made the scan, never twice |
| Offline retries | A repeated `client_event_id` returns the state, it does not re-stamp |
| Staff PINs | bcrypt hashed, with a per-device lockout after 5 wrong tries |
| Card artwork | Stamp grid rendered to PNG, immutable and CDN-cacheable |
| Queue | Every card-affecting change enqueues a wallet push |

## Not built yet

**Apple Wallet and Google Wallet delivery.** Everything else is finished and
testable; these two are blocked on accounts, not on code. See
`packages/passes/src/apple.ts` and `google.ts` — each says exactly what to
implement and what it needs first.

Three things have waiting periods outside our control, so start them early:

1. **Apple Developer Program** ($99/yr). A company account needs a D-U-N-S
   number and can take over a week.
2. **Google Wallet issuer account.** New issuers start in *demo mode*, where
   only allowlisted Google accounts can save a pass. Going live needs a
   publishing review — days, not hours.
3. **A domain with HTTPS.** Apple will not talk to the pass web service without
   one.

> **Annual landmine:** the Apple pass certificate expires every year. When it
> lapses, no new passes can be signed *and every existing card silently stops
> updating*. Put a calendar reminder at 11 months.

Also still to come: owner dashboard and onboarding, Stripe billing, SMS card
recovery, the Expo scanner app, printable QR PDFs.

---

## Layout

```
apps/web            Next.js — join page, web scanner, API
packages/shared     Card tokens, PIN hashing, constants, card-state rules
packages/db         Schema, migrations, seed, typed queries
packages/passes     Stamp-strip renderer, colour extraction, wallet stubs
```

### Database

A plain local Postgres, not Supabase — Supabase needs Docker, which this Mac
does not have. That costs nothing: Supabase *is* Postgres, the migrations apply
to either unchanged, and switching means pointing `DATABASE_URL` at the Supabase
connection string. Row Level Security policies are already written
(`0002_rls.sql`) and activate when owner auth lands.

```bash
pnpm db:migrate   # apply pending migrations
pnpm db:seed      # reset the demo shop
pnpm db:reset     # drop everything and start over
```

### The queue

Nothing talks to Apple or Google inside a web request. A design change on a
shop with 2,000 members means 2,000 pushes and 2,000 pass re-signings — done
inline that would hit the serverless time limit partway through, with no record
of who was missed. So requests enqueue, and a worker drains:

```bash
curl -X POST localhost:3000/api/jobs/drain -H "Authorization: Bearer $CRON_SECRET"
```

In production this runs on a cron. Today every job is skipped, with the reason
recorded, because neither wallet is configured.

---

## Decisions worth knowing

**Stamps cap at a full card.** A customer at 9/10 who buys two drinks gets one
stamp, and the scanner says the other was not added. Capping is what keeps
"redeem resets to zero" honest. The alternative — letting the count overflow —
is fairer to that customer but makes the card's maths harder to explain. This
is a product call, easy to reverse: see `addStamps` in `apps/web/src/lib/stamps.ts`.

**The card's QR never changes.** It is baked into a signed pass on the
customer's phone, so it cannot rotate. A photo of a card is therefore a lasting
stamping credential. The defences are the cooldown and the fact that every
event records which staff member caused it — detection, not prevention. Watch
*rewards redeemed per staff member*; that is where money leaks.

**Card artwork contains no text.** Adding a word would mean shipping a font:
image text is drawn with whatever fonts the host has, and a serverless Linux box
has almost none, so text that looks right on a Mac vanishes in production. The
reward wording lives in a pass field, where the phone draws it properly.
Reward-ready inverts the card's colours instead of captioning itself.

**Phone numbers are for card recovery only.** The consent checkbox on the join
page is separate and optional, and the moment of consent is recorded. Under
CASL consent cannot be granted retroactively — so if marketing SMS is ever
wanted, the record has to start now or the existing member base is unusable
for it.
