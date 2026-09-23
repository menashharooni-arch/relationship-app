-- ── Analytics audit clean-up (2026-09-23) ───────────────────────────────────
--
-- Four one-off deletes for rows the audit proved are not customers. Run in the
-- Supabase SQL editor by the owner. Every statement is scoped so a real
-- customer row cannot match; counts at audit time are noted beside each.
--
-- Read before running: supabase shows a "destructive operations" confirm.

-- 1. Orphan demo leads: seeded by scripts/qa-office-links-brand.mjs against a
--    card that no longer exists. 131 of the 166 rows in `leads` (audit time).
--    Real contacts always have a live card; the `demo` tag is belt and braces.
delete from public.leads l
where 'demo' = any (l.tags)
  and not exists (
    select 1 from public.cards c where lower(c.username) = lower(l.card_owner)
  );

-- 2. Orphan card views: views whose card (or Swift Links page) no longer
--    exists. 8 rows at audit time. Customer dashboards never showed them; the
--    site-wide admin total did.
delete from public.card_views v
where not exists (
  select 1 from public.cards c
  where lower(c.username) = regexp_replace(lower(v.username), '__links$', '')
);

-- 3. The 2026-09-18 location backfill kept a working copy of card_views with
--    row-level security OFF (Supabase advisor: critical). The backfill is done;
--    the copy has no reader.
drop table if exists public.card_views_geo_backfill_20260918;

-- 4. Welcome-email log rows for QA throwaways (1,081 at audit time). The mail
--    bounced; the log should describe mail that went to people. The sender
--    now refuses these addresses (src/lib/test-mailbox.ts), so this is a
--    one-time clean-up, not maintenance.
delete from public.email_logs
where email ilike '%@swiftcard-test.invalid';
