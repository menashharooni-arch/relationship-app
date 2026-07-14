-- Scheduled seat reductions (spec §5). SAFE & ADDITIVE. Idempotent.
--
-- A reduction is scheduled to take effect at the END of the current billing
-- period: we store the future target + effective date here, keep the current
-- seats billable/available until then, and a daily job applies it once due.
--
-- Run in the Supabase SQL editor.
-- Rollback:
--   alter table offices drop column if exists scheduled_seats;
--   alter table offices drop column if exists scheduled_seats_at;

alter table if exists public.offices add column if not exists scheduled_seats integer;
alter table if exists public.offices add column if not exists scheduled_seats_at timestamptz;
