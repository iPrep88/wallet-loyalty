-- Which part of their logo goes in Google's circle.
--
-- We size a logo automatically and it is right most of the time. But no rule
-- can know that a brand's round symbol belongs in the circle and its wordmark
-- does not — only the owner knows that, and for a shop whose mark is the
-- recognisable part, showing the whole logo shrunk to fit is strictly worse.
--
-- Null means automatic, which is what almost every shop will leave it as.
-- When set, it is a SQUARE in the source image's own pixels, so re-deriving
-- the tile at any size stays exact and we never store a second copy of their
-- logo that could drift out of step with the first.
--
-- Apple is deliberately unaffected: PassKit draws the logo in a rectangle at
-- the top of the pass, so a wordmark shows there in full. This crop exists
-- because Google draws a circle, and for no other reason.
alter table programs
  add column if not exists logo_crop jsonb;

comment on column programs.logo_crop is
  'Null = fit the whole logo automatically. Otherwise {"x":n,"y":n,"size":n} '
  'as a square in the source logo''s own pixels, chosen by the owner.';
