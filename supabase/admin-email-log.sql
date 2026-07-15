-- Admin "Send email to users" campaign log.
--
-- SAFE & ADDITIVE: creates one new table and adds two nullable columns to
-- email_logs — never drops or rewrites data. Idempotent; run in the Supabase
-- SQL editor. Until it is run, broadcasts still send exactly as before — the
-- app just can't show the "View sent emails" history (it says so in the UI).
--
-- Rollback:
--   drop table if exists admin_email_campaigns;
--   alter table email_logs drop column if exists campaign_id;
--   alter table email_logs drop column if exists error;

-- One row per campaign sent through the private admin "Send email to users"
-- tool (created BEFORE sending with status 'processing', finalized after).
CREATE TABLE IF NOT EXISTS admin_email_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Client-generated key: a double-click / retry of the same confirm can't
  -- create a second campaign or a second send.
  idempotency_key text UNIQUE,
  sent_by         text NOT NULL,                    -- admin's email
  segment         text NOT NULL,                    -- all | free | pro | office
  subject         text NOT NULL,
  headline        text,
  body            text,
  cta_label       text,
  cta_url         text,
  intended_count  integer NOT NULL DEFAULT 0,       -- recipients in the segment at send time
  sent_count      integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  skipped_count   integer NOT NULL DEFAULT 0,       -- unsubscribed / no email address
  status          text NOT NULL DEFAULT 'processing', -- processing | sent | partial | failed
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS admin_email_campaigns_created_idx
  ON admin_email_campaigns (created_at DESC);

-- Per-recipient outcomes reuse the existing email_logs table: a campaign_id
-- ties rows to the campaign, and failures/skips are now recorded too (status
-- 'failed' / 'skipped' with the reason in `error`) instead of vanishing.
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error text;
CREATE INDEX IF NOT EXISTS email_logs_campaign_idx ON email_logs (campaign_id);

-- Service-role only — never exposed to clients directly (same as email_logs).
ALTER TABLE admin_email_campaigns ENABLE ROW LEVEL SECURITY;
