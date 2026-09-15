-- ── Durable visit identity for card_views ────────────────────────────────────
-- APPLIED TO PRODUCTION 2026-09-14 (SQL editor, project grxmovpmlgmjncnyiyrt).
-- Kept as the canonical record; idempotent (IF NOT EXISTS throughout), safe to
-- re-run.
--
-- Goes with src/lib/visit-identity.ts and the dedupe rewrite in
-- src/lib/record-view.ts. The app degrades cleanly until this runs — a missing
-- column is caught as 42703/PGRST204 and the view is recorded without it — so
-- deploying the code first is safe; it simply keeps counting one visit more
-- than once for storage-less browsers until the column exists.
--
-- WHY. The 30-minute visit dedupe (view-visit-window.sql) keys on visitor_id,
-- and visitor_id was minted by page script into localStorage. A browser that
-- cannot keep that value hands up a new one on every load, so the lookup
-- matches nothing and one visit becomes N views and N "unique visitors".
-- Production, 2026-09-14 15:55-15:56, card menashharooni-swiftcard-2 (created
-- 15:54:28): four card_views rows, four different visitor ids, ninety seconds.
--
-- device_key is a SALTED HASH of (card key + IP + User-Agent), computed in the
-- app. It is not an identity and is never displayed: the raw IP is still not
-- persisted, and salting with the card key means the stored value cannot be
-- used to follow one device across two owners' cards. It answers exactly one
-- question — "has this browser on this network already been counted for THIS
-- card in this visit?" — which is the question a client with no durable
-- storage cannot answer for us.

-- 1 ── The column -------------------------------------------------------------
ALTER TABLE public.card_views ADD COLUMN IF NOT EXISTS device_key text;

-- 2 ── The lookup the dedupe runs ---------------------------------------------
-- Mirrors the existing (username, visitor_id, viewed_at) access path. Partial:
-- every row written before this migration carries NULL, and there is no point
-- indexing them.
CREATE INDEX IF NOT EXISTS idx_card_views_device_window
  ON public.card_views (username, device_key, viewed_at DESC)
  WHERE device_key IS NOT NULL;

-- 3 ── The race backstop, on the same 30-minute bucket ------------------------
-- The twin of uq_card_views_visitor_bucket (view-visit-window.sql). Two
-- requests for the same visit that arrive close enough to both pass the
-- app-layer check land in the same bucket and the second one loses — which
-- record-view.ts already treats as a normal dedup (23505). Change the bucket
-- width here only together with VIEW_VISIT_WINDOW_MS and card_view_bucket().
--
-- Scoped to rows written from this migration onward so it builds cleanly over
-- history, exactly as uq_card_events_visitor_bucket is.
CREATE UNIQUE INDEX IF NOT EXISTS uq_card_views_device_bucket
  ON public.card_views (username, device_key, public.card_view_bucket(viewed_at))
  WHERE device_key IS NOT NULL AND viewed_at >= '2026-09-15 00:00:00+00';
