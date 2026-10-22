-- 0004 changed WHICH card styles are allowed and forgot the column's DEFAULT,
-- which was still 'stamps'. Signup creates a program without naming a style,
-- so every new shop inserted the old default and was rejected by the new
-- constraint — a 500 on the Create my shop button, on a live site.
--
-- The seed hit the identical bug an hour earlier by naming 'stamps' outright.
-- Changing an allowed set of values means finding every place one of them can
-- come from: the constraint, the defaults, the seed, and the code.
alter table programs alter column card_style set default 'minimal';
