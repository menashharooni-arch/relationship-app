-- SwiftCard messaging setup — run once in the Supabase SQL editor.
-- Safe & idempotent (re-running does nothing).

-- 1) Conversation threads (outbound + inbound messages per contact).
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

-- 2) Opt-out / suppression list (STOP for SMS, unsubscribe for email).
--    Keyed by normalized contact so a STOP suppresses that number platform-wide.
CREATE TABLE IF NOT EXISTS message_opt_outs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel    text NOT NULL,                 -- 'sms' | 'email'
  contact    text NOT NULL,                 -- last-10-digits phone, or lowercased email
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, contact)
);
