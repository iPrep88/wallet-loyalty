-- A new shop's card should come out of the box as the one every customer
-- already knows: ten boxes, nine of them stamps, the tenth the prize.
--
-- The default was ten stamps, which was right when the grid was ten identical
-- boxes and wrong the moment the reward got a box of its own — it made the
-- card eleven boxes wide and the deal "buy ten, get the eleventh free",
-- which nobody prints.
alter table programs alter column stamps_required set default 9;

-- Existing rows are left where they are on purpose. A shop that told its
-- customers "ten stamps" is still telling them that; the number they promised
-- is not ours to quietly move.
