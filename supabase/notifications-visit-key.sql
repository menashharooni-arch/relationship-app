-- ONE NOTIFICATION PER PERSON PER VISIT.
--
-- visit_key = "<card slug>:<visitor id or ip hash>:<30-min visit bucket>".
-- The partial unique index is the ledger: a second event from the same visitor
-- in the same visit cannot insert a second row, so the code upgrades the row
-- that is already there (viewed -> saved) instead of stacking a duplicate.
--
-- Applied to production 2026-09-03.
alter table public.notifications add column if not exists visit_key text;

create unique index if not exists notifications_visit_key_idx
  on public.notifications (visit_key)
  where visit_key is not null;
