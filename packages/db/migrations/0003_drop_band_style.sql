-- Drops the 'band' card style.
--
-- It let an owner put their own image across the card, and in the wrong hands
-- that produced something ugly — which is worse than plain, because a shop
-- that thinks the card looks cheap puts the QR stand in a drawer. A style
-- that only works when the owner has design sense is not a style worth
-- shipping.
--
-- Anyone already on it moves to the stamp grid, which is what it fell back to
-- without artwork anyway.
update programs set card_style = 'stamps' where card_style = 'band';

alter table programs drop constraint if exists programs_card_style_check;
alter table programs add constraint programs_card_style_check
  check (card_style in ('stamps','minimal','progress'));

-- The column stays: dropping it would lose artwork an owner uploaded, and it
-- costs nothing to leave until we are sure nobody wants this back.
comment on column programs.band_image_url is
  'Unused since 0003. Kept so an upload is not silently destroyed.';
