-- 0004 renamed the card mode from 'band' to 'photo' but left the assets table
-- still only accepting the old word, so every photo upload failed on a check
-- constraint — a 500 with no message, at the exact moment a merchant is
-- trying to make their card look good.
--
-- Existing rows move across; nothing was uploaded under the old name in
-- production, but a migration that only works on an empty table is not a
-- migration.
update assets set kind = 'photo' where kind = 'band';

alter table assets drop constraint if exists assets_kind_check;
alter table assets add constraint assets_kind_check
  check (kind in ('logo','icon','photo','stamp_glyph'));
