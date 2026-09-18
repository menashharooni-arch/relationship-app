-- ── Warm-lead re-engagement: who a returning visitor IS ──────────────────────
-- NOT YET APPLIED. Idempotent (IF NOT EXISTS throughout), safe to re-run.
-- Plan: docs/plans/warm-lead-alerts.md (PR A3). The owner applies it in the
-- SQL editor; nothing in the app requires it until PR A4, and A4 degrades on
-- 42703/PGRST204 exactly like record-view.ts does for device_key.
--
-- WHY. card_views and card_events know a BROWSER (visitor_id = the sc_vid
-- cookie). A lead knows a PERSON. Nothing joined the two except a visitor_id
-- copied onto the lead at submit time, which covered only the browser that
-- filled the form and none of the contacts added by hand or by scanning a
-- business card. These tables make the join explicit, auditable and
-- reversible:
--
--   contact_links    a per-contact token (?ct=) on every card link SwiftCard
--                    sends a lead. Opening it is how a device is recognised
--                    when the person never filled in the form on it.
--   contact_devices  lead ↔ browser bindings, each saying HOW it was earned
--                    (form | link | account). The only source a named alert
--                    may ever come from.
--   lead_id columns  stamped server-side at ingest on card_events,
--                    card_views and notifications, so per-contact history,
--                    scoring and "open this contact" never match on names.
--
-- Access: RLS ON with NO policies on the two new tables, i.e. service role
-- only — the same stance as card_events and lead_messages. Every read goes
-- through a server route scoped by ownsLead() / getOwnerUsernames().
--
-- Retention (owner decision D7, 2026-09-18): bindings and lead_id stamps are
-- kept until the contact or the account is deleted. On contact delete
-- (decision D8) the notifications about them go too; their visits stay as
-- anonymous rows (lead_id → NULL).

-- 1 ── Tracked per-contact links ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 10 random base62 characters (~59 bits), minted in the app. Opaque: it
  -- carries no lead id, no name, nothing a forwarded message could leak.
  token            text NOT NULL UNIQUE,
  lead_id          uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_slug        text NOT NULL,
  channel          text NOT NULL CHECK (channel IN ('sms', 'email', 'share_card', 'manual_copy', 'scanner')),
  lead_message_id  uuid REFERENCES public.lead_messages(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  first_opened_at  timestamptz,
  open_count       integer NOT NULL DEFAULT 0,
  -- A forwarded link may bind at most 3 devices (plan §2.1).
  devices_bound    integer NOT NULL DEFAULT 0,
  -- Set when the contact unsubscribes or the owner revokes; a revoked token
  -- binds nothing and is otherwise an ordinary card link.
  revoked_at       timestamptz
);
CREATE INDEX IF NOT EXISTS idx_contact_links_lead ON public.contact_links (lead_id, created_at DESC);
ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;

-- 2 ── Lead ↔ browser bindings -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_devices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  -- The card OWNER's account, not the slug: the same contact opening the
  -- owner's second card is still the same contact.
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id     text NOT NULL,
  bound_via      text NOT NULL CHECK (bound_via IN ('form', 'link', 'account')),
  link_id        uuid REFERENCES public.contact_links(id) ON DELETE SET NULL,
  bound_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz,
  -- A DIFFERENT person later submitted this owner's form on the same browser:
  -- the newest submitter owns it from then on (shared iPad at an open house).
  superseded_at  timestamptz,
  -- The owner said "Wrong person?". Never used again, kept as the trust metric.
  wrong_at       timestamptz,
  UNIQUE (lead_id, visitor_id)
);
-- The hot path: "is this browser a known contact of this owner?"
CREATE INDEX IF NOT EXISTS idx_contact_devices_owner_visitor
  ON public.contact_devices (owner_id, visitor_id)
  WHERE superseded_at IS NULL AND wrong_at IS NULL;
ALTER TABLE public.contact_devices ENABLE ROW LEVEL SECURITY;

-- 3 ── lead_id on the activity rows ------------------------------------------
-- SET NULL, not CASCADE: deleting a contact makes their visits anonymous
-- again; it must not rewrite the owner's view counts.
ALTER TABLE public.card_events ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE public.card_events ADD COLUMN IF NOT EXISTS lead_confidence text;
-- The link's own label ("Listings", "Book a call"), capped at 60 in the app.
-- `target` stays the bare host.
ALTER TABLE public.card_events ADD COLUMN IF NOT EXISTS target_label text;
CREATE INDEX IF NOT EXISTS idx_card_events_lead
  ON public.card_events (lead_id, created_at DESC) WHERE lead_id IS NOT NULL;

ALTER TABLE public.card_views ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_card_views_lead
  ON public.card_views (lead_id, viewed_at DESC) WHERE lead_id IS NOT NULL;

-- CASCADE (decision D8): a deleted contact disappears from the bell too.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE;
-- Stamped when the owner opens the notification (push tap or bell click):
-- the first step of the alert → follow-up → meeting funnel.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS opened_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_notifications_lead
  ON public.notifications (lead_id) WHERE lead_id IS NOT NULL;

-- 4 ── Backfill: every lead that already carries a visitor_id is a 'form'
--      binding for that browser. Owner resolved from the card slug, falling
--      back to a legacy profile username. Leads whose owner can't be resolved
--      are skipped, never guessed.
INSERT INTO public.contact_devices (lead_id, owner_id, visitor_id, bound_via, bound_at)
SELECT l.id,
       COALESCE(c.user_id, p.id),
       l.visitor_id,
       'form',
       l.created_at
FROM public.leads l
LEFT JOIN public.cards c    ON lower(c.username) = lower(l.card_owner)
LEFT JOIN public.profiles p ON lower(p.username) = lower(l.card_owner)
WHERE l.visitor_id IS NOT NULL
  AND COALESCE(c.user_id, p.id) IS NOT NULL
ON CONFLICT (lead_id, visitor_id) DO NOTHING;
