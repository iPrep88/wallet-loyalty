-- Proving someone controls an inbox.
--
-- Two problems that were really one. A shop owner who mistyped their email at
-- signup lost the account permanently — nothing checked the address was real,
-- and nothing could send them a way back in. Both need the same thing: a way
-- to prove control of an inbox.
--
-- One table serves both, because a verification link and a reset link differ
-- only in what they authorise. Tokens are random, single-use and expiring, and
-- only their SHA-256 hash is stored — a copy of this database should not be a
-- list of working password-reset links.

alter table users add column email_verified_at timestamptz;

create table email_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  kind       text not null check (kind in ('verify', 'reset')),
  -- Unique so a (vanishingly unlikely) repeat cannot silently shadow another
  -- account's live token.
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Issuing a new token retires that user's outstanding ones of the same kind,
-- which is a lookup by (user, kind) on every send.
create index email_tokens_user_idx on email_tokens (user_id, kind);
