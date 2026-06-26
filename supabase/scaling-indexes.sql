-- ============================================================================
-- SwiftCard performance indexes — run ONCE in the Supabase SQL editor.
-- Safe & idempotent: every statement uses IF NOT EXISTS, so re-running is a no-op.
-- These keep the hot queries fast as your tables grow into the millions of rows
-- (card views, leads, events). Without them, those queries do full-table scans
-- and get exponentially slower under traffic.
--
-- If your DB is ALREADY live and busy, replace each `CREATE INDEX` with
-- `CREATE INDEX CONCURRENTLY` and run the statements ONE AT A TIME (CONCURRENTLY
-- cannot run inside a transaction). On a fresh/low-traffic DB, run as-is.
-- ============================================================================

-- ── Public lookups (hit on EVERY card / Swift Links / OG-image view) ────────
CREATE INDEX IF NOT EXISTS idx_cards_username           ON public.cards (username);
CREATE INDEX IF NOT EXISTS idx_profiles_username        ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_cards_user_id_created    ON public.cards (user_id, created_at);

-- ── card_views — highest-volume table (one insert per public view) ──────────
-- Serves both the plain "<username>" key and the "<username>__links" key,
-- and every dashboard count/range/order on viewed_at.
CREATE INDEX IF NOT EXISTS idx_card_views_username_viewed_at ON public.card_views (username, viewed_at);

-- ── card_events — high-volume event log ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_card_events_owner_created   ON public.card_events (card_owner_username, created_at);
CREATE INDEX IF NOT EXISTS idx_card_events_owner_visitor   ON public.card_events (card_owner_username, visitor_id, created_at);

-- ── leads — contacts/CRM ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_owner_created   ON public.leads (card_owner, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_owner_name      ON public.leads (card_owner, name);
CREATE INDEX IF NOT EXISTS idx_leads_created_at      ON public.leads (created_at);  -- follow-up cron window scan

-- ── notifications ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read    ON public.notifications (user_id, read);

-- ── analytics_events ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_events_username_type ON public.analytics_events (username, event_type);

-- ── lead_reminders ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lead_reminders_lead_day ON public.lead_reminders (lead_id, day_trigger);

-- ── Stripe webhook lookups (must be fast so billing events don't pile up) ───
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer     ON public.profiles (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription ON public.profiles (stripe_subscription_id);

-- ── Optional tables (only created if the table exists in your schema) ────────
-- Wrapped so a missing table never aborts the whole script.
DO $$ BEGIN
  IF to_regclass('public.integrations')   IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_integrations_user_provider ON public.integrations (user_id, provider); END IF;
  IF to_regclass('public.offices')        IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_offices_owner            ON public.offices (owner_id); END IF;
  IF to_regclass('public.office_members') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_office_members_invite ON public.office_members (invite_token);
    CREATE INDEX IF NOT EXISTS idx_office_members_office ON public.office_members (office_id);
  END IF;
  IF to_regclass('public.email_preferences') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_email_prefs_user  ON public.email_preferences (user_id);
    CREATE INDEX IF NOT EXISTS idx_email_prefs_token ON public.email_preferences (unsubscribe_token);
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_push_user     ON public.push_subscriptions (user_id);
    CREATE INDEX IF NOT EXISTS idx_push_endpoint ON public.push_subscriptions (endpoint);
  END IF;
  IF to_regclass('public.promo_codes') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes (code); END IF;
  IF to_regclass('public.promo_code_redemptions') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code_user ON public.promo_code_redemptions (code_id, user_id); END IF;
END $$;

-- Update planner statistics so the new indexes are used right away.
ANALYZE;
