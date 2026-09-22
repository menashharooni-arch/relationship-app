-- Tester codes: a promo that OPENS A PLAN instead of discounting a purchase.
--
-- Applied to production 2026-09-22 (Supabase MCP migration
-- "promo_grant_discount_type"). Kept here so the schema is readable from the
-- repo and a fresh project can be brought to the same shape.
--
-- Why it exists: every other promo type ends at Stripe — a coupon or a trial on
-- a real subscription, each of which still collects a card. There was no way to
-- open Pro or Office on a throwaway account just to look at the product without
-- leaving a test subscription in the LIVE Stripe account. A "grant" code does
-- that: /api/promo/redeem switches the account to the plan for free_days days
-- with no Stripe call at all, and expireFreeMonths (the daily reminders cron,
-- the same path a referral free month uses) returns it to Free when time is up.
--
-- The guards live in the route, pinned by tests/promo-grant-code.test.ts: a
-- grant refuses any account that has a Stripe subscription, never writes a plan
-- down, always sets an expiry, and clears the Stripe-trial keys so no
-- "you'll be charged" notice can follow it.
alter table promo_codes drop constraint if exists promo_codes_discount_type_check;
alter table promo_codes add constraint promo_codes_discount_type_check
  check (discount_type = any (array['percent'::text, 'fixed'::text, 'free_time'::text, 'grant'::text]));

-- The two codes themselves are rows, not schema — created 2026-09-22, 30 days
-- each, 50 uses, expiring 2027-09-22:
--   TESTPRO-AB0EDEA1     applies_to 'pro'
--   TESTOFFICE-AB0EDEA1  applies_to 'office'
-- Rotate one by deactivating the row (active = false) and inserting a new code.
