-- Wallet Loyalty — initial schema
-- Portable between a plain local Postgres and Supabase (Supabase is just Postgres).
-- owner_user_id is a bare uuid rather than a FK to auth.users so this file applies
-- cleanly in both places; Supabase's auth schema is added by 0002_rls.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- businesses
create table businesses (
  id                   uuid primary key default gen_random_uuid(),
  owner_user_id        uuid,
  name                 text not null,
  slug                 text not null unique,
  -- REVIEW FIX: without this, "visits this week" is silently a UTC week.
  timezone             text not null default 'America/Toronto',
  stripe_customer_id   text,
  subscription_status  text not null default 'trialing'
                         check (subscription_status in
                           ('trialing','active','past_due','canceled','paused')),
  trial_ends_at        timestamptz,
  created_at           timestamptz not null default now()
);

create index businesses_owner_idx on businesses (owner_user_id);

-- ------------------------------------------------------------------ programs
create table programs (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses (id) on delete cascade,
  stamps_required  int  not null default 10 check (stamps_required between 1 and 20),
  reward_text      text not null default 'Free drink',
  join_bonus       int  not null default 1 check (join_bonus between 0 and 5),
  cooldown_seconds int  not null default 120 check (cooldown_seconds >= 0),

  logo_url         text,
  icon_url         text,
  stamp_icon       text not null default 'circle'
                     check (stamp_icon in ('cup','boba','bean','star','heart','circle','custom')),
  stamp_icon_url   text,
  bg_color         text not null default '#1F2933',
  fg_color         text not null default '#FFFFFF',
  label_color      text not null default '#B8C2CC',

  back_address     text,
  back_hours       text,
  back_instagram   text,
  back_menu_url    text,
  back_terms       text not null default
    'One stamp per purchase. Rewards have no cash value.',

  -- Bump on ANY change that alters how the card looks. Part of the strip cache key.
  design_version   int  not null default 1,
  google_class_id  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index programs_business_idx on programs (business_id);

-- ------------------------------------------------------------------- members
create table members (
  id                   uuid primary key default gen_random_uuid(),
  program_id           uuid not null references programs (id) on delete cascade,
  serial               uuid not null unique default gen_random_uuid(),
  -- Apple requires an authenticationToken of at least 16 characters.
  auth_token           text not null default encode(gen_random_bytes(24), 'hex')
                         check (length(auth_token) >= 16),

  phone                text,
  first_name           text,
  -- REVIEW FIX: CASL consent cannot be granted retroactively. Capture it from
  -- day one or the whole existing member base is unusable for SMS later.
  sms_consent_at       timestamptz,

  stamps               int not null default 0 check (stamps >= 0),
  rewards_earned       int not null default 0 check (rewards_earned >= 0),
  total_visits         int not null default 0 check (total_visits >= 0),
  last_visit_at        timestamptz,
  -- REVIEW FIX: cooldown is measured from the last STAFF stamp, never from the
  -- join bonus — otherwise the join bonus blocks the first real purchase stamp.
  last_staff_stamp_at  timestamptz,

  platform             text check (platform in ('apple','google')),
  google_object_id     text,
  created_at           timestamptz not null default now(),
  -- REVIEW FIX: Apple's passesUpdatedSince endpoint cannot be implemented
  -- without a per-member changed-at timestamp.
  updated_at           timestamptz not null default now()
);

-- REVIEW FIX: nothing stopped one phone number joining the same shop twice,
-- which made card recovery ambiguous (which card do we re-issue?).
create unique index members_program_phone_key
  on members (program_id, phone) where phone is not null;
create index members_program_idx     on members (program_id);
create index members_updated_at_idx  on members (program_id, updated_at desc);

-- -------------------------------------------------------------------- staff
create table staff (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name        text not null,
  pin_hash    text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index staff_business_idx on staff (business_id) where active;

-- REVIEW FIX: a 4-digit PIN is 10,000 guesses and the spec rate-limited SMS
-- recovery but not this. Lockout is per scanner device, not per staff row,
-- because a guesser does not know which staff member they are matching.
create table pin_attempts (
  business_id  uuid not null references businesses (id) on delete cascade,
  device_id    text not null,
  attempts     int  not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (business_id, device_id)
);

-- -------------------------------------------------------------- stamp_events
create table stamp_events (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references members (id) on delete cascade,
  staff_id        uuid references staff (id) on delete set null,
  type            text not null
                    check (type in ('join','stamp','redeem','adjust','undo')),
  quantity        int  not null default 1,
  -- Set on EVERY event, not just offline ones: an online retry double-counts
  -- just as happily as a re-synced offline queue.
  client_event_id text not null unique default gen_random_uuid()::text,
  -- For 'undo' rows: which event this reverses. Stops a retried undo from
  -- decrementing twice.
  undoes_event_id uuid unique references stamp_events (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index stamp_events_member_idx on stamp_events (member_id, created_at desc);
create index stamp_events_staff_idx  on stamp_events (staff_id, created_at desc);

-- ------------------------------------------------------- apple_registrations
create table apple_registrations (
  id                uuid primary key default gen_random_uuid(),
  device_library_id text not null,
  push_token        text not null,
  member_id         uuid not null references members (id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (device_library_id, member_id)
);

create index apple_registrations_member_idx on apple_registrations (member_id);

-- ----------------------------------------------------------------- broadcasts
create table broadcasts (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references programs (id) on delete cascade,
  message         text not null,
  sent_at         timestamptz not null default now(),
  recipient_count int not null default 0
);

create index broadcasts_program_idx on broadcasts (program_id, sent_at desc);

-- ---------------------------------------------------------------------- jobs
-- REVIEW FIX: "pushes an update to every existing card" is thousands of APNs
-- sends and pass re-signings. A loop inside a request handler hits the
-- serverless time limit partway through and you never learn which members were
-- missed. Everything that touches a wallet goes through this table instead,
-- drained by a cron worker.
create table jobs (
  id           bigserial primary key,
  kind         text not null
                 check (kind in ('push_member','push_program','google_patch','strip_warm')),
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

-- --------------------------------------------------------- updated_at upkeep
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
