-- Scope in-app notifications to a card, so the dashboard bell + Notifications
-- panel only show the currently-selected card's activity.
-- Run once in the Supabase SQL editor. Safe & idempotent.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS card_owner text;
CREATE INDEX IF NOT EXISTS idx_notifications_user_card
  ON notifications (user_id, card_owner, created_at DESC);
