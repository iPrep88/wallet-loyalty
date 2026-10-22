-- The stored-image cap was 2MB, which is smaller than a photo off any phone
-- made in the last decade. It was also the wrong thing to limit: uploads are
-- resized and re-encoded before they are stored, so the ceiling belongs on
-- the result, not on what someone hands us.
--
-- 8MB is far more than a 1600px JPEG or a quantised PNG needs, and is there
-- only to stop something pathological reaching the table.
alter table assets drop constraint if exists assets_size_limit;
alter table assets add constraint assets_size_limit
  check (octet_length(bytes) <= 8 * 1024 * 1024);
