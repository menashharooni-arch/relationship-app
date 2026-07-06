-- ============================================================================
-- SwiftCard — ALL migrations, consolidated. Run ONCE in the Supabase SQL editor
-- (Supabase → SQL Editor → New query → paste this whole file → Run).
--
-- Fully idempotent: every statement uses IF NOT EXISTS / CREATE OR REPLACE, so
-- running it again does nothing. Safe on a live database. (If your DB is already
-- large and busy, see the note above the indexes section at the bottom.)
--
-- What it sets up:
--   • Per-card notifications (dashboard bell scoping)
--   • Conversation threads + SMS/email opt-out (STOP) list
--   • Email preferences, send logs, promo codes, receipts backfill
--   • Office/team uniform branding columns
--   • Performance indexes for the hot queries
-- ============================================================================


-- ── 0) Make optional lead columns nullable ──────────────────────────────────
-- The "share your info" form only requires name + phone; email/company/message/
-- location are optional. If these columns are NOT NULL, a phone-only capture
-- fails with "null value ... violates not-null constraint" and the visitor sees
-- "something went wrong". DROP NOT NULL is idempotent (no-op if already nullable).
ALTER TABLE leads ALTER COLUMN email    DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN phone    DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN company  DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN message  DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN location DROP NOT NULL;


-- ── 1) Per-card notifications ───────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS card_owner text;
CREATE INDEX IF NOT EXISTS idx_notifications_user_card
  ON notifications (user_id, card_owner, created_at DESC);


-- ── 2) Conversation threads + opt-out (STOP / unsubscribe) list ─────────────
CREATE TABLE IF NOT EXISTS lead_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  card_owner text,
  direction  text NOT NULL DEFAULT 'out',  -- 'out' (you → contact) or 'in' (their reply)
  channel    text,                          -- 'email' | 'sms'
  body       text NOT NULL,
  status     text,                          -- 'sent' | 'failed' | 'not_configured'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_messages_lead ON lead_messages (lead_id, created_at);

CREATE TABLE IF NOT EXISTS message_opt_outs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel    text NOT NULL,                 -- 'sms' | 'email'
  contact    text NOT NULL,                 -- last-10-digits phone, or lowercased email
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, contact)
);


-- ── 3) Email system: preferences, promo codes, send logs ────────────────────
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_emails  boolean DEFAULT true,
  receipt_emails    boolean DEFAULT true,
  unsubscribe_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text UNIQUE NOT NULL,
  description      text,
  discount_percent integer CHECK (discount_percent BETWEEN 1 AND 100),
  discount_type    text DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_amount  integer,
  max_uses         integer,
  uses_count       integer DEFAULT 0,
  expires_at       timestamptz,
  plan_target      text DEFAULT 'free' CHECK (plan_target IN ('free', 'all', 'pro')),
  stripe_coupon_id text,
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id     uuid REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  UNIQUE(code_id, user_id)
);

CREATE TABLE IF NOT EXISTS email_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email      text NOT NULL,
  type       text NOT NULL,
  subject    text,
  resend_id  text,
  status     text DEFAULT 'sent',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner" ON email_preferences;
DROP POLICY IF EXISTS "owner_prefs" ON email_preferences;
CREATE POLICY "owner_prefs" ON email_preferences FOR ALL USING (auth.uid() = user_id);

-- Give every existing user a preferences row.
INSERT INTO email_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;


-- ── 4) Office/team uniform branding ─────────────────────────────────────────
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_logo_url      text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_company       text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_website       text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_template      text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_custom_layout jsonb;


-- ── 5) Performance indexes ──────────────────────────────────────────────────
-- If your DB is ALREADY large and under traffic, swap each `CREATE INDEX` below
-- for `CREATE INDEX CONCURRENTLY` and run them one at a time (CONCURRENTLY can't
-- run inside a transaction). On a fresh/low-traffic DB, run as-is.
CREATE INDEX IF NOT EXISTS idx_cards_username                ON public.cards (username);
CREATE INDEX IF NOT EXISTS idx_profiles_username             ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_cards_user_id_created         ON public.cards (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_card_views_username_viewed_at ON public.card_views (username, viewed_at);
CREATE INDEX IF NOT EXISTS idx_card_events_owner_created     ON public.card_events (card_owner_username, created_at);
CREATE INDEX IF NOT EXISTS idx_card_events_owner_visitor     ON public.card_events (card_owner_username, visitor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_owner_created           ON public.leads (card_owner, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_owner_name              ON public.leads (card_owner, name);
CREATE INDEX IF NOT EXISTS idx_leads_created_at              ON public.leads (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created    ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read       ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_lead_day       ON public.lead_reminders (lead_id, day_trigger);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer      ON public.profiles (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription  ON public.profiles (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_lead_messages_lead2           ON public.lead_messages (lead_id, created_at);

-- Optional tables — only indexed if they exist, so a missing table never errors.
DO $$ BEGIN
  IF to_regclass('public.analytics_events') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_analytics_events_username_type ON public.analytics_events (username, event_type); END IF;
  IF to_regclass('public.integrations')   IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_integrations_user_provider ON public.integrations (user_id, provider); END IF;
  IF to_regclass('public.offices')        IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_offices_owner ON public.offices (owner_id); END IF;
  IF to_regclass('public.office_members') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_office_members_invite ON public.office_members (invite_token);
    CREATE INDEX IF NOT EXISTS idx_office_members_office ON public.office_members (office_id);
  END IF;
  IF to_regclass('public.email_preferences') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_email_prefs_token ON public.email_preferences (unsubscribe_token);
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_push_user     ON public.push_subscriptions (user_id);
    CREATE INDEX IF NOT EXISTS idx_push_endpoint ON public.push_subscriptions (endpoint);
  END IF;
  IF to_regclass('public.message_opt_outs') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_opt_outs_channel_contact ON public.message_opt_outs (channel, contact); END IF;
  IF to_regclass('public.promo_codes') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes (code); END IF;
  IF to_regclass('public.promo_code_redemptions') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code_user ON public.promo_code_redemptions (code_id, user_id); END IF;
END $$;

ANALYZE;
