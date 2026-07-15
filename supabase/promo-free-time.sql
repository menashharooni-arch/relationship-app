-- ── Promo codes: free time instead of a percentage ──────────────────────────
-- Run ONCE in the Supabase SQL Editor (Supabase → SQL Editor → New query →
-- paste → Run). Additive and idempotent — safe to re-run.
--
-- Until it is run: creating a free-time code fails with a clear error (the
-- discount_type CHECK rejects 'free_time'), and existing percent/fixed codes
-- keep working exactly as they do today. Nothing breaks.
--
-- Rollback:
--   alter table public.promo_codes drop column if exists free_days;
--   alter table public.promo_codes drop constraint if exists promo_codes_discount_type_check;
--   alter table public.promo_codes add constraint promo_codes_discount_type_check
--     check (discount_type in ('percent','fixed'));

-- ── 1. free_days ────────────────────────────────────────────────────────────
-- How many days of the plan the code hands out, free.
--
-- Days, not months, because Stripe coupons can only express whole MONTHS
-- (duration_in_months) — "one week free" is impossible as a coupon. Free time is
-- a TRIAL (subscription_data.trial_period_days), which takes an exact day count,
-- so the four offers map cleanly: 7 / 14 / 30 / 60.
--
-- NULL for percent/fixed codes. Bounded by the app to the four allowed values;
-- the CHECK here is a wide sanity bound rather than the allow-list, so adding a
-- fifth option later is a code change, not a migration.
alter table if exists public.promo_codes
  add column if not exists free_days integer
  check (free_days is null or (free_days > 0 and free_days <= 365));

-- ── 2. Allow discount_type = 'free_time' ────────────────────────────────────
-- The existing CHECK only permits ('percent','fixed'), so a free-time insert is
-- rejected outright until this runs. Drop and re-add rather than ALTER — Postgres
-- has no "modify constraint".
do $$
begin
  if to_regclass('public.promo_codes') is not null then
    -- The constraint name is whatever Postgres generated for the inline CHECK in
    -- email-system.sql; find it by definition rather than guessing the name.
    execute (
      select coalesce(
        (select 'alter table public.promo_codes drop constraint ' || quote_ident(conname)
         from pg_constraint
         where conrelid = 'public.promo_codes'::regclass
           and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%discount_type%'
         limit 1),
        'select 1'
      )
    );

    alter table public.promo_codes
      add constraint promo_codes_discount_type_check
      check (discount_type in ('percent', 'fixed', 'free_time'));
  end if;
end $$;

-- ── 3. Backfill ─────────────────────────────────────────────────────────────
-- Nothing to backfill: every existing row is percent or fixed and keeps a NULL
-- free_days. Stated explicitly so it's clear this was considered, not forgotten.
