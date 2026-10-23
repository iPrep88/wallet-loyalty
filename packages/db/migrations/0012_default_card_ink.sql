-- A brand new shop landed on #1F2933, a slate that matched none of the
-- ready-made cards — so the picker opened with nothing selected and the
-- starting card was one nobody had designed.
--
-- Ink is the default now: it is one of the six, and it is the most forgiving
-- ground for a logo we have not seen yet.
alter table programs alter column bg_color    set default '#14181F';
alter table programs alter column fg_color    set default '#F2F4F7';
alter table programs alter column label_color set default '#8E97A3';

-- Existing shops keep whatever they are wearing. Their colours are theirs.
