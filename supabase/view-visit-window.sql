-- ── Visit-window view counting + tracking-pipeline hardening ─────────────────
-- Run once in the Supabase SQL Editor. Idempotent (IF EXISTS / IF NOT EXISTS /
-- OR REPLACE throughout), safe to re-run.
--
-- Goes with the app-side change that replaced the 24h view dedup with a
-- 30-minute VISIT window (src/lib/view-window.ts): a reload inside the window
-- is one visit; a genuine return later the same day is a REPEAT VIEW and now
-- records (and notifies) again. If the app constant changes, the bucket width
-- here must change with it.

-- 1 ── Visit-bucket race backstop on card_views ------------------------------
-- Replaces the UTC-calendar-day unique index (card-views-race-fix.sql): one
-- row per (card, visitor, 30-min bucket). Two near-simultaneous requests for
-- the same visit always land in the same bucket, so the TOCTOU race the old
-- index closed stays closed — without suppressing same-day repeat views.
-- Historical rows were deduped per-day, so at most one exists per bucket and
-- the index builds cleanly.
CREATE OR REPLACE FUNCTION public.card_view_bucket(ts timestamptz)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT floor(extract(epoch FROM ts) / 1800)::bigint
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_card_views_visitor_bucket
  ON public.card_views (username, visitor_id, public.card_view_bucket(viewed_at))
  WHERE visitor_id IS NOT NULL;

DROP INDEX IF EXISTS uq_card_views_username_visitor_day;

-- 2 ── card_events: location column + the same visit backstop ----------------
-- The event row is what the owner's notification and the contact timeline
-- read, and it never carried a location — so the push could not honestly say
-- where a view came from. Nullable text, same shape as card_views.location
-- ("City, CC"); missing stays NULL, the app never writes a placeholder.
ALTER TABLE public.card_events ADD COLUMN IF NOT EXISTS location text;

-- One event (and therefore one notification) per visitor per card per visit
-- window, guaranteed at the database even when two serverless instances race
-- the app-layer check. Partial: only the two visit-shaped event types.
CREATE UNIQUE INDEX IF NOT EXISTS uq_card_events_visitor_bucket
  ON public.card_events (card_owner_username, visitor_id, event_type, public.card_view_bucket(created_at))
  WHERE visitor_id IS NOT NULL AND event_type IN ('viewed_card', 'downloaded_vcard');

-- 3 ── push_subscriptions: endpoint must be UNIQUE ---------------------------
-- The subscribe route upserts with onConflict:"endpoint", which REQUIRES a
-- unique constraint — without one every registration fails with 42P10, or
-- worse, plain inserts let two accounts hold rows for one device token and
-- both accounts' pushes land on the same phone. Dedupe first (keep the
-- newest row per endpoint — ctid order approximates insert order when no
-- created_at column exists), then enforce.
DELETE FROM public.push_subscriptions a
  USING public.push_subscriptions b
  WHERE a.endpoint = b.endpoint AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_endpoint
  ON public.push_subscriptions (endpoint);

-- 4 ── card_views: RLS on, no policies (service-role only) -------------------
-- Every legitimate reader/writer of card_views goes through the service role
-- (the view API and the dashboards); the dashboard code has asserted "RLS is
-- on with no select policy" for months, but no migration in the repo actually
-- enabled it — leaving the table readable through PostgREST with the public
-- anon key. RLS with zero policies = anon/authenticated see nothing;
-- service_role bypasses RLS by design.
ALTER TABLE public.card_views ENABLE ROW LEVEL SECURITY;

-- 5 ── Office analytics RPCs: EXECUTE for service_role only ------------------
-- These are SECURITY INVOKER functions created with Postgres's default
-- EXECUTE TO PUBLIC, so PostgREST exposed them to anon/authenticated — anyone
-- with the anon key could read ANY card's view stats by posting arbitrary
-- p_keys. The app only ever calls them with the admin (service-role) client.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'office_employee_view_stats',
    'office_employee_lead_stats',
    'office_employee_contact_stats',
    'office_daily_views',
    'office_traffic_sources'
  ] LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(text[], timestamptz, timestamptz) FROM PUBLIC, anon, authenticated',
        fn
      );
    EXCEPTION WHEN undefined_function THEN
      -- Environment where office-analytics-dashboard.sql hasn't run — nothing
      -- to lock down yet; that script should be followed by a re-run of this.
      NULL;
    END;
  END LOOP;
END $$;

-- 6 ── True office-wide unique visitors --------------------------------------
-- One count(DISTINCT) across the whole team's keys. Summing the per-employee
-- unique_visitors counted a visitor who opened three colleagues' cards three
-- times; this is the number the office dashboard's "Unique visitors" tile
-- actually claims to be.
CREATE OR REPLACE FUNCTION public.office_unique_visitors(
  p_keys text[], p_since timestamptz, p_until timestamptz
) RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT count(DISTINCT visitor_id)
  FROM public.card_views
  WHERE username = ANY(p_keys)
    AND viewed_at >= p_since AND viewed_at < p_until
    AND visitor_id IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.office_unique_visitors(text[], timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
