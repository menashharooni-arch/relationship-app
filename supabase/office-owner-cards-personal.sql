-- Office owners' personal cards are INDIVIDUAL — repair + guardrail.
--
-- An earlier branding change flagged the office owner's seed card as
-- is_office_card=true and included the owner in every branding propagation,
-- which rewrote the admin's own cards with the office template. The code now
-- excludes owners everywhere (propagateBrandToOfficeCards,
-- resolveBrandTargetIds, getMemberBrandForUser, the card editor lock); this
-- migration repairs the DATA by un-flagging every card that belongs to an
-- office OWNER, so no office-scoped update can ever touch them again.
--
-- The original template/colors an owner's card had before the overwrite were
-- not recorded anywhere, so they can't be auto-restored — but with the flag
-- and locks gone the admin can freely re-pick any design in Edit Card and it
-- will stick.
--
-- Run once in Supabase → SQL Editor. Idempotent.

UPDATE cards c
SET is_office_card = false
FROM offices o
WHERE c.user_id = o.owner_id
  AND c.is_office_card = true;
