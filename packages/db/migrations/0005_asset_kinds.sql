-- 0004 renamed the card mode from 'band' to 'photo' but left the assets table
-- accepting only the old word, so every photo upload died on a check
-- constraint — a 500 with no message, at the exact moment a merchant is
-- trying to make their card look good.
--
-- Order matters here, and the first version of this file got it wrong: the
-- constraint has to go BEFORE the rows move, or the update is rejected by the
-- very rule it is trying to replace. That passed on a machine with no 'band'
-- rows, where the update touched nothing, and failed on the one that had some.
alter table assets drop constraint if exists assets_kind_check;

update assets set kind = 'photo' where kind = 'band';

alter table assets add constraint assets_kind_check
  check (kind in ('logo','icon','photo','stamp_glyph'));
