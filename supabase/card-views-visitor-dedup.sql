-- Stops a page reload from inflating the view count. The API now dedupes by
-- (username, visitor_id) within a 24h window before inserting a new row, so
-- the same visitor refreshing the page doesn't count as a second view.
-- Run once in the Supabase SQL Editor. IF NOT EXISTS, safe to re-run.
ALTER TABLE public.card_views ADD COLUMN IF NOT EXISTS visitor_id text;
CREATE INDEX IF NOT EXISTS idx_card_views_username_visitor_id ON public.card_views (username, visitor_id, viewed_at);
