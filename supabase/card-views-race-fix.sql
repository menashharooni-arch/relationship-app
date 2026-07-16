-- Closes a TOCTOU race in the 24h visitor dedup: two near-simultaneous
-- requests for the same visitor (double tab, client double-fire) could both
-- pass the app-layer "recent row?" check before either insert committed,
-- producing two card_views rows for one visit. This adds a same-day unique
-- backstop; the app-layer check now treats the resulting unique-violation
-- (Postgres error 23505) as a normal dedup rather than an error.
--
-- Not a perfect match for the app's rolling 24h window (this is a calendar-day
-- boundary), but it closes the actual race window described (two requests
-- milliseconds apart always land on the same UTC day) without requiring a
-- broader schema change. Run once in the Supabase SQL Editor. IF NOT EXISTS,
-- safe to re-run.
CREATE UNIQUE INDEX IF NOT EXISTS uq_card_views_username_visitor_day
  ON public.card_views (username, visitor_id, (viewed_at::date))
  WHERE visitor_id IS NOT NULL;
