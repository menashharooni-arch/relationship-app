-- Surfaces a dead integration instead of showing "Connected" forever. When a
-- token refresh fails (revoked access, app uninstalled from the provider's
-- side, etc.), sync_error is set and the Settings UI shows "Reconnect needed"
-- instead of the green Connected badge. A successful refresh/reconnect clears it.
-- Run once in the Supabase SQL Editor. IF NOT EXISTS, safe to re-run.
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS sync_error text;

-- The Google/HubSpot OAuth callback routes upsert with
-- `onConflict: "user_id,provider"` — that requires a real unique constraint
-- (or unique index) on (user_id, provider), which only a plain non-unique
-- index existed for previously. Without this, reconnecting the same provider
-- can silently duplicate rows instead of updating the existing one.
--
-- If this fails with "could not create unique index — duplicate key violates",
-- it means duplicate (user_id, provider) rows already exist from before this
-- fix. Clean those up first, keeping the most recently updated row per pair:
--   DELETE FROM public.integrations a USING public.integrations b
--   WHERE a.user_id = b.user_id AND a.provider = b.provider
--     AND a.updated_at < b.updated_at;
-- then re-run the CREATE UNIQUE INDEX below.
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_user_provider_unique ON public.integrations (user_id, provider);
