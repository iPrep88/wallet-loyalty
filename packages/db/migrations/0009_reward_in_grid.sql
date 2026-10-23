-- A paper punch card does not show ten identical boxes. It shows nine boxes
-- and a tenth with the prize drawn in it, which is why "buy nine, get the
-- tenth free" is a sentence every customer already understands and "collect
-- ten stamps" is one they have to be told.
--
-- Both cards need exactly the same number of visits. The difference is only
-- whether the last box on the card is a stamp slot or the reward — so this is
-- one flag, not a second counter that could drift out of step with
-- stamps_required.
alter table programs
  add column if not exists reward_in_grid boolean not null default true;

comment on column programs.reward_in_grid is
  'True: the grid is stamps_required stamp slots plus a reward box at the end '
  '(buy 9, get the 10th free). False: stamps_required slots, all identical.';
