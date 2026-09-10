-- ── One bell row per visit, milestones included ─────────────────────────────
--
-- Run once in the Supabase SQL Editor. Idempotent and purely ADDITIVE: one
-- nullable column and one partial unique index. Nothing is dropped, renamed or
-- rewritten, and no existing row changes.
--
-- THE BUG. A single view that happened to cross a view milestone produced TWO
-- notifications a second apart. Reported by the owner twice; reproduced in
-- production on 2026-09-09:
--
--   21:47:55  milestone_50  "50 views — on fire!"
--   21:47:56  card_viewed   "Someone viewed your Swift Links."
--
-- /api/card-events deduped on the VISIT (notifications.visit_key), but
-- lib/milestones.ts wrote its own row through insertNotification and deduped
-- only against itself, so the visit ledger never saw it. The milestone is now
-- announced through notifyVisit like everything else, upgrading the view's row
-- instead of adding a second one.
--
-- WHY A COLUMN AND NOT JUST THE TYPE. A milestone must announce exactly once,
-- ever, per card. That ledger used to be the row's `type` being "milestone_50".
-- Once the milestone shares a row with the rest of the visit, the type is no
-- longer stable: a contact saved or a lead captured ten minutes later upgrades
-- the SAME row and rewrites type to contact_saved / new_lead. The ledger would
-- be erased and the milestone would fire again on the next view — which is
-- exactly the trap a previous attempt at this fell into, and why
-- tests/one-notification-per-visit.test.ts has guarded the type since.
--
-- So the ledger gets its own column that upgrade() sets and NEVER clears.

alter table public.notifications add column if not exists milestone text;

-- The real race backstop. lib/milestones.ts does a check-then-announce, and two
-- views committing either side of a milestone boundary can both pass the check;
-- whoever loses this index gets a 23505 and simply doesn't announce.
--
-- Partial, so ordinary notifications (the overwhelming majority, milestone null)
-- are completely unaffected and can still be many per card.
create unique index if not exists notifications_milestone_once_idx_v2
  on public.notifications (card_owner, milestone)
  where card_owner is not null and milestone is not null;

-- ── Backfill the ledger from history ────────────────────────────────────────
-- Milestones announced before this column existed are recorded by their type.
-- Copying that across means they are not all re-announced once on the next
-- view. Only touches rows that ARE a milestone and have no ledger value yet.
update public.notifications
   set milestone = type
 where type like 'milestone\_%'
   and milestone is null
   and card_owner is not null;

-- ── The old type-based index ────────────────────────────────────────────────
-- KEPT, deliberately, not dropped. It still correctly prevents two rows from
-- both ending up typed "milestone_N" on one card, it costs nothing, and leaving
-- it means this migration removes nothing at all. (It is no longer the ledger —
-- the column above is — because a type can be upgraded away and a ledger cannot.)
create unique index if not exists notifications_milestone_once_idx
  on public.notifications (card_owner, type)
  where card_owner is not null and type like 'milestone\_%';

-- Proof: every milestone row should now carry a ledger value.
select
  count(*) filter (where type like 'milestone\_%')                        as milestone_rows,
  count(*) filter (where type like 'milestone\_%' and milestone is null)  as missing_ledger
from public.notifications;
