-- Office analytics accuracy (2026-09-23 analytics audit). APPLIED to
-- production 2026-09-23 (migration office_analytics_accuracy_2026_09_23).
-- Supersedes the three function bodies in office-analytics-dashboard.sql and
-- view-visit-window.sql; same signatures, so grants are unchanged.

-- 1) Leads: the sample contact every new card starts with (tags 'demo') is not
--    a lead. The Team page and recent-leads list already excluded it, so the
--    Analytics tiles, per-employee Leads, Conversion and the CSV disagreed.
CREATE OR REPLACE FUNCTION office_employee_lead_stats(
  p_usernames text[], p_since timestamptz, p_until timestamptz
) RETURNS TABLE (username text, leads bigint, last_lead_at timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT card_owner, count(*), max(created_at)
  FROM leads
  WHERE card_owner = ANY(p_usernames) AND created_at >= p_since AND created_at < p_until
    AND NOT ('demo' = ANY(coalesce(tags, '{}'::text[])))
  GROUP BY 1
$$;

-- 2) Unique visitors: a view with no visitor id (a browser that could keep
--    none) counts as its own viewer — the personal dashboard's rule — so the
--    two screens show the same number for the same card.
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
    count(DISTINCT visitor_id) + count(*) FILTER (WHERE visitor_id IS NULL) AS unique_visitors,
    max(viewed_at) AS last_view_at
  FROM card_views
  WHERE username = ANY(p_keys) AND viewed_at >= p_since AND viewed_at < p_until
  GROUP BY 1
$$;

CREATE OR REPLACE FUNCTION public.office_unique_visitors(
  p_keys text[], p_since timestamptz, p_until timestamptz
) RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT count(DISTINCT visitor_id) + count(*) FILTER (WHERE visitor_id IS NULL)
  FROM public.card_views
  WHERE username = ANY(p_keys)
    AND viewed_at >= p_since AND viewed_at < p_until
$$;

-- 3) Chart days in the viewer's local calendar (applied as migration
--    office_daily_views_tz_2026_09_23). A new name, not an overload, so an old
--    three-argument caller can never become an ambiguous call.
CREATE OR REPLACE FUNCTION public.office_daily_views_tz(
  p_keys text[], p_since timestamptz, p_until timestamptz, p_tz text
) RETURNS TABLE (day date, views bigint)
LANGUAGE sql STABLE AS $$
  SELECT (viewed_at AT TIME ZONE p_tz)::date, count(*)
  FROM public.card_views
  WHERE username = ANY(p_keys) AND viewed_at >= p_since AND viewed_at < p_until
  GROUP BY 1 ORDER BY 1
$$;
REVOKE EXECUTE ON FUNCTION public.office_daily_views_tz(text[], timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.office_daily_views_tz(text[], timestamptz, timestamptz, text) TO service_role;
