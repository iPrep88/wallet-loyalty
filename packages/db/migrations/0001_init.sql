-- Wallet Loyalty — schema
--
-- Shape: an owner signs in, owns companies, each company has stores.
-- The card's look and its rules live at the company level, so a three-shop
-- owner designs their card once. Stamps live at the STORE level — a card
-- earned at Dundas St is not spendable at Yonge St.
--
-- Portable between a plain local Postgres and a hosted one; nothing here is
-- specific to any provider.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- owners
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  name          text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Email is matched case-insensitively; nobody expects Ben@ and ben@ to be
-- two accounts.
create unique index users_email_lower_key on users (lower(email));

-- -------------------------------------------------------------- companies
-- The brand. "Bubble Tea Co". Owns the card design and the subscription.
create table companies (
  id                  uuid primary key default gen_random_uuid(),
  owner_user_id       uuid not null references users (id) on delete cascade,
  name                text not null,
  slug                text not null unique,
  timezone            text not null default 'America/Toronto',

  stripe_customer_id  text,
  subscription_status text not null default 'trialing'
                        check (subscription_status in
                          ('trialing','active','past_due','canceled','paused')),
  trial_ends_at       timestamptz,
  created_at          timestamptz not null default now()
);

create index companies_owner_idx on companies (owner_user_id);

-- ----------------------------------------------------------------- stores
-- A physical location. Its own stamp pool, its own counter QR, its own staff.
create table stores (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name       text not null,
  slug       text not null unique,          -- the /j/<slug> join URL
  address    text,

  -- Put into the pass so the card surfaces on a customer's lock screen when
  -- they are near the shop. Free, and the strongest return-visit driver there
  -- is — a card in a drawer is dead.
  latitude   double precision,
  longitude  double precision,

  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index stores_company_idx on stores (company_id) where active;

-- --------------------------------------------------------------- programs
-- The card: how it looks, what it takes, what it gives. One per company.
create table programs (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,

  -- Owner's choice, not three fixed options: a $4 coffee and a $7 boba want
  -- different cards, and a shorter card brings people back sooner.
  stamps_required int not null default 10 check (stamps_required between 3 and 20),

  -- Shown on the face of the card, where space is tight. Enforced short here
  -- rather than discovered truncated on a customer's phone.
  reward_text       text not null default 'Free drink' check (length(reward_text) <= 24),
  -- What one reward costs the shop. Turns "61 rewards redeemed" into
  -- "$427 given away this month", which is the number an owner feels.
  reward_value_cents int check (reward_value_cents >= 0),

  join_bonus       int not null default 1 check (join_bonus between 0 and 5),
  cooldown_seconds int not null default 120 check (cooldown_seconds >= 0),

  -- Four looks, one renderer. 'stamps' is the grid; 'minimal' is just a count
  -- in the corner; 'band' is their own image; 'progress' is a filling bar.
  card_style text not null default 'stamps'
               check (card_style in ('stamps','minimal','band','progress')),

  logo_url       text,
  icon_url       text,
  band_image_url text,                      -- for card_style = 'band'
  stamp_icon     text not null default 'circle',
  stamp_icon_url text,                      -- an AI-drawn or uploaded glyph

  bg_color    text not null default '#1F2933',
  fg_color    text not null default '#FFFFFF',
  label_color text not null default '#B8C2CC',

  back_address   text,
  back_hours     text,
  back_instagram text,
  back_menu_url  text,
  back_terms     text not null default
    'One stamp per purchase. Rewards have no cash value.',

  -- Bump on any change that alters how the card looks. Part of the artwork
  -- cache key, so one edit refreshes every member's card at once.
  design_version  int not null default 1,
  google_class_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index programs_company_key on programs (company_id);

-- ---------------------------------------------------------------- members
-- A customer's card, at one store.
create table members (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores (id) on delete cascade,
  serial     uuid not null unique default gen_random_uuid(),
  -- Apple requires an authenticationToken of at least 16 characters.
  auth_token text not null default encode(gen_random_bytes(24), 'hex')
               check (length(auth_token) >= 16),

  phone          text,
  first_name     text,
  -- CASL consent cannot be granted retroactively. Record the moment, or
  -- nothing at all.
  sms_consent_at timestamptz,

  stamps         int not null default 0 check (stamps >= 0),
  rewards_earned int not null default 0 check (rewards_earned >= 0),
  total_visits   int not null default 0 check (total_visits >= 0),
  last_visit_at  timestamptz,
  -- Cooldown counts from the last STAFF stamp, never from the joining bonus,
  -- or the free stamp would block the first real purchase seconds later.
  last_staff_stamp_at timestamptz,

  platform         text check (platform in ('apple','google')),
  google_object_id text,
  created_at       timestamptz not null default now(),
  -- Apple's passesUpdatedSince endpoint cannot be implemented without this.
  updated_at       timestamptz not null default now()
);

-- One phone number, one card per store — otherwise card recovery cannot tell
-- which card to re-issue.
create unique index members_store_phone_key
  on members (store_id, phone) where phone is not null;
create index members_store_idx      on members (store_id);
create index members_updated_at_idx on members (store_id, updated_at desc);
-- Answers "how many are sitting on 8 stamps" without scanning the table.
create index members_stamps_idx     on members (store_id, stamps);

-- ------------------------------------------------------------------ staff
create table staff (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores (id) on delete cascade,
  name       text not null,
  pin_hash   text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index staff_store_idx on staff (store_id) where active;

-- A 4-digit PIN is 10,000 guesses. Lockout is per scanner DEVICE, not per
-- staff row: a guesser does not know whose PIN they are matching, so counting
-- per staff member would let them walk the whole space.
create table pin_attempts (
  store_id     uuid not null references stores (id) on delete cascade,
  device_id    text not null,
  attempts     int  not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (store_id, device_id)
);

-- ----------------------------------------------------------- stamp_events
-- The ledger. Every number on the dashboard is derived from these rows, so
-- they carry the store and the staff member who caused them.
create table stamp_events (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  store_id  uuid not null references stores (id) on delete cascade,
  staff_id  uuid references staff (id) on delete set null,
  type      text not null check (type in ('join','stamp','redeem','adjust','undo')),
  quantity  int  not null default 1,

  -- What the reward was worth when it was given, copied at the time: a shop
  -- raising its prices must not silently rewrite last year's figures.
  reward_value_cents int,

  -- Set on EVERY event, not just offline ones. An online retry double-counts
  -- just as happily as a re-synced offline queue.
  client_event_id text not null unique default gen_random_uuid()::text,
  -- For 'undo' rows: the event being reversed. Unique, so a retried undo
  -- cannot decrement twice.
  undoes_event_id uuid unique references stamp_events (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index stamp_events_member_idx on stamp_events (member_id, created_at desc);
create index stamp_events_store_idx  on stamp_events (store_id, created_at desc);
create index stamp_events_staff_idx  on stamp_events (staff_id, created_at desc);
create index stamp_events_type_idx   on stamp_events (store_id, type, created_at desc);

-- ------------------------------------------------- apple device registry
create table apple_registrations (
  id                uuid primary key default gen_random_uuid(),
  device_library_id text not null,
  push_token        text not null,
  member_id         uuid not null references members (id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (device_library_id, member_id)
);

create index apple_registrations_member_idx on apple_registrations (member_id);

-- ------------------------------------------------------------- broadcasts
create table broadcasts (
  id       uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  message  text not null check (length(message) <= 120),
  -- 'all', or a targeted slice such as everyone one stamp short — which is
  -- the version worth sending.
  audience text not null default 'all'
             check (audience in ('all','one_away','lapsed','reward_ready')),
  sent_at         timestamptz not null default now(),
  recipient_count int not null default 0
);

create index broadcasts_store_idx on broadcasts (store_id, sent_at desc);

-- ------------------------------------------------------------------ jobs
-- Nothing talks to Apple or Google inside a web request. A design change on a
-- shop with 2,000 members is 2,000 pushes and 2,000 pass re-signings; done
-- inline it dies partway through a serverless time limit and nobody learns
-- which members were missed.
create table jobs (
  id           bigserial primary key,
  kind         text not null check (kind in
                 ('push_member','push_program','google_patch','strip_warm',
                  'weekly_digest','quiet_store_check')),
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
                 check (status in ('pending','running','done','failed')),
  attempts     int  not null default 0,
  max_attempts int  not null default 5,
  last_error   text,
  run_after    timestamptz not null default now(),
  locked_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index jobs_claim_idx on jobs (status, run_after) where status = 'pending';

-- --------------------------------------------------------- updated_at
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger programs_touch before update on programs
  for each row execute function touch_updated_at();
create trigger members_touch before update on members
  for each row execute function touch_updated_at();
create trigger jobs_touch before update on jobs
  for each row execute function touch_updated_at();
