-- Uploading a logo always rewrote the card's colours, so an owner who had
-- picked a palette and then added their logo lost the palette — and there was
-- no way to keep one and change the other. Automatic is right the first time
-- and wrong every time after.
--
-- Once someone has deliberately chosen colours, we stop choosing for them.
alter table programs
  add column if not exists colors_chosen boolean not null default false;

comment on column programs.colors_chosen is
  'True once the owner picked or edited colours themselves. A logo upload '
  'then offers its palette instead of applying it.';

-- Anyone who already has a logo has lived with whatever we picked; treat that
-- as ours, not theirs, so their next upload still improves it.
