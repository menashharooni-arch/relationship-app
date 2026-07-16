-- Office Analytics Dashboard: source attribution + aggregate functions.
-- Run ONCE in the Supabase SQL editor. Additive only — every statement is
-- IF NOT EXISTS / CREATE OR REPLACE, safe to re-run.
--
-- Historical card_views rows have source IS NULL — the dashboard surfaces
-- those as "Unknown" rather than guessing. Only rows recorded after this
-- migration ships (and after the app-side changes that populate `source`)
-- carry real attribution.

-- ── 1) Source attribution on card_views ──────────────────────────────────
ALTER TABLE public.card_views ADD COLUMN IF NOT EXISTS source text;

-- Covering index for the traffic-sources query (username ANY + viewed_at
-- range, grouped by source). card_views is the highest-volume table in the
-- app and this query runs on every dashboard load and every employee detail
-- view, so it's justified up front rather than added reactively later.
CREATE INDEX IF NOT EXISTS idx_card_views_username_viewed_source
  ON public.card_views (username, viewed_at, source);

-- ── 2) Partial index for "contacts saved" (downloaded_vcard events) ──────
-- card_events also logs a 'viewed_card' row on EVERY page view (undeduped —
-- the highest-volume rows in that table). Scoping the index to just the
-- vcard-download rows keeps this specific query small without bloating the
-- existing general-purpose (card_owner_username, created_at) index.
CREATE INDEX IF NOT EXISTS idx_card_events_owner_created_vcard
  ON public.card_events (card_owner_username, created_at)
  WHERE event_type = 'downloaded_vcard';

-- NOTE: card_views(username, viewed_at) and leads(card_owner, created_at)
-- already exist via scaling-indexes.sql — not duplicated here.

-- ── 3) Per-slug view stats ────────────────────────────────────────────────
-- p_keys = the office's flattened [slug, slug + '__links', ...] list, built
-- the same way office-analytics.ts's countViews() already does. Grouped by
-- the BASE slug (a trailing "__links" stripped, matching
-- self-traffic.ts's baseSlugForOwnerLookup convention) — callers re-group by
-- user_id afterward for employees who own more than one card slug.
CREATE OR REPLACE FUNCTION office_employee_view_stats(
  p_keys text[], p_since timestamptz, p_until timestamptz
) RETURNS TABLE (
  username text,
  views bigint,
  swiftlink_views bigint,
  scans bigint,
  unique_visitors bigint,
  last_view_at timestamptz
) LANGUAGE sql STABLE AS $$
  SELECT
    regexp_replace(username, '__links$', '') AS username,
    count(*) FILTER (WHERE username !~ '__links$') AS views,
    count(*) FILTER (WHERE username ~ '__links$') AS swiftlink_views,
    count(*) FILTER (WHERE source IN ('qr_code', 'nfc_card')) AS scans,
    count(DISTINCT visitor_id) AS unique_visitors,
    max(viewed_at) AS last_view_at
  FROM card_views
  WHERE username = ANY(p_keys) AND viewed_at >= p_since AND viewed_at < p_until
  GROUP BY 1
$$;

-- ── 4) Per-slug leads ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION office_employee_lead_stats(
  p_usernames text[], p_since timestamptz, p_until timestamptz
) RETURNS TABLE (username text, leads bigint, last_lead_at timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT card_owner, count(*), max(created_at)
  FROM leads
  WHERE card_owner = ANY(p_usernames) AND created_at >= p_since AND created_at < p_until
  GROUP BY 1
$$;

-- ── 5) Per-slug contacts saved (vCard downloads) ─────────────────────────
CREATE OR REPLACE FUNCTION office_employee_contact_stats(
  p_usernames text[], p_since timestamptz, p_until timestamptz
) RETURNS TABLE (username text, contacts_saved bigint, last_contact_at timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT card_owner_username, count(*), max(created_at)
  FROM card_events
  WHERE card_owner_username = ANY(p_usernames) AND event_type = 'downloaded_vcard'
    AND created_at >= p_since AND created_at < p_until
  GROUP BY 1
$$;

-- ── 6) Day-bucketed time series (UTC calendar days) ──────────────────────
-- Reused for both the office-wide summary chart (pass every office key) and
-- a single employee's detail chart (pass just their keys).
CREATE OR REPLACE FUNCTION office_daily_views(
  p_keys text[], p_since timestamptz, p_until timestamptz
) RETURNS TABLE (day date, views bigint)
LANGUAGE sql STABLE AS $$
  SELECT (date_trunc('day', viewed_at AT TIME ZONE 'utc'))::date, count(*)
  FROM card_views
  WHERE username = ANY(p_keys) AND viewed_at >= p_since AND viewed_at < p_until
  GROUP BY 1 ORDER BY 1
$$;

-- ── 7) Traffic-source breakdown ───────────────────────────────────────────
-- Office-wide, or per-employee by narrowing p_keys to just that person's slugs.
CREATE OR REPLACE FUNCTION office_traffic_sources(
  p_keys text[], p_since timestamptz, p_until timestamptz
) RETURNS TABLE (source text, views bigint)
LANGUAGE sql STABLE AS $$
  SELECT coalesce(source, 'unknown'), count(*)
  FROM card_views
  WHERE username = ANY(p_keys) AND viewed_at >= p_since AND viewed_at < p_until
  GROUP BY 1 ORDER BY 2 DESC
$$;
