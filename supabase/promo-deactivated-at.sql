-- Promo log: record WHEN a code was deactivated so the admin promo log can
-- show how long each code was active. Optional — the delete route falls back
-- to a plain active=false if this column doesn't exist yet.
--
-- Run in Supabase → SQL Editor.

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
