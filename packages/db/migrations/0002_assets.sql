-- Uploaded images — shop logos, custom stamp glyphs, band artwork.
--
-- Kept in the database rather than a file store or a cloud bucket. They are
-- small, there are a handful per shop, and this way they are covered by the
-- same backup as everything else and there is no second service to host,
-- credential or pay for. If they ever grow past that, moving them out is a
-- migration, not a redesign.
create table assets (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  kind       text not null check (kind in ('logo','icon','band','stamp_glyph')),
  mime       text not null check (mime in ('image/png','image/jpeg','image/webp','image/svg+xml')),
  bytes      bytea not null,
  width      int,
  height     int,
  created_at timestamptz not null default now(),
  -- Guard rail: a shop logo has no business being megabytes. Enforced again
  -- at the upload endpoint, where a friendlier message is possible.
  constraint assets_size_limit check (octet_length(bytes) <= 2 * 1024 * 1024)
);

create index assets_company_idx on assets (company_id, kind);
