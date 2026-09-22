-- ── "Rate us" dashboard banner: per-user 60-day snooze ──────────────────────
--
-- The web dashboard shows a small "Rate us on the App Store" banner after a
-- good moment (first real lead, or 5+ card views). Dismissing OR clicking it
-- hides it for 60 days. Stored on the profile rather than in localStorage so
-- one dismissal holds on every device and browser. Rules: src/lib/rate-us.ts.
--
-- Written only by the server (/api/profile/rate-us, service role) — `profiles`
-- accepts no client writes (profiles-privileged-column-guard.sql), so nothing
-- else needs to change here.
--
-- Rollback:
--   alter table public.profiles drop column if exists rate_us_dismissed_at;

alter table public.profiles add column if not exists rate_us_dismissed_at timestamptz;
