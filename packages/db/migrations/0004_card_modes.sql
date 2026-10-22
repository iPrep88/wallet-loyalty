-- Card modes, reframed.
--
-- The old 'styles' were three ways of drawing the stamp row, which is not a
-- decision a shop owner should be making — and offering it produced exactly
-- the Canva problem: a merchant assembling a card out of parts, badly.
--
-- A mode is now about the GROUND the card sits on, and the system composes
-- everything over it:
--
--   minimal  logo, brand colour, a considered stamp row. No image needed, and
--            the default, because it is also the one that looks most
--            expensive.
--   photo    the merchant hands over one picture; we crop and scrim it.
--   ai       generated brand artwork. Not built — a column value waiting.
--
-- Everyone on the old values lands on minimal, which is what they were
-- looking at anyway.
update programs set card_style = 'minimal' where card_style in ('stamps','progress');

alter table programs drop constraint if exists programs_card_style_check;
alter table programs add constraint programs_card_style_check
  check (card_style in ('minimal','photo','ai'));

-- 0003 kept this column so nobody's upload was destroyed. It now has a real
-- job again, under a name that says what it holds.
alter table programs rename column band_image_url to photo_url;
comment on column programs.photo_url is
  'Merchant photograph for card_style = photo. Cropped and scrimmed at render.';
