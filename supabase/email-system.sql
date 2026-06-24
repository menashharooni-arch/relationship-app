-- SwiftCard Email System
-- Safe to run multiple times (fully idempotent)

-- 1. Email preferences
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_emails  boolean DEFAULT true,
  receipt_emails    boolean DEFAULT true,
  unsubscribe_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 2. Promo codes
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

-- 3. Promo code redemptions
CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id     uuid REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  UNIQUE(code_id, user_id)
);

-- 4. Email send log
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

-- RLS
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Drop policies first so re-runs don't fail
DROP POLICY IF EXISTS "owner" ON email_preferences;
DROP POLICY IF EXISTS "owner_prefs" ON email_preferences;

-- Users can read/update their own preferences
CREATE POLICY "owner_prefs" ON email_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Backfill existing users
INSERT INTO email_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
