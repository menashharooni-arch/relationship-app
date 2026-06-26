-- Conversation messages (outbound from a user to a contact, via email or SMS).
-- Run once in the Supabase SQL editor.
CREATE TABLE IF NOT EXISTS lead_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  card_owner text,
  direction  text NOT NULL DEFAULT 'out',  -- 'out' (you → contact) or 'in'
  channel    text,                          -- 'email' | 'sms'
  body       text NOT NULL,
  status     text,                          -- 'sent' | 'failed' | 'not_configured'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_messages_lead ON lead_messages (lead_id, created_at);
