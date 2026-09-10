-- ── Analytics accuracy: surface, geo confidence, ingest audit ────────────────
--
-- Run once in the Supabase SQL Editor. Idempotent throughout (IF NOT EXISTS /
-- OR REPLACE), safe to re-run, and ADDITIVE ONLY: nothing is dropped except one
-- unique index that is replaced by a strictly more permissive one in the same
-- statement block, and no column changes meaning.
--
-- Every app change that depends on this degrades safely while it is unapplied:
-- a missing column surfaces as Postgres 42703 / PostgREST PGRST204 and the
-- writer retries without it (the pattern card_events.location and
-- notifications.visit_key already use). So the code can ship before this runs.
--
-- Four things:
--   1  card_events.surface         — a Swift Links view stops being erased by
--                                    the card view from the same visit
--   2  *.geo_accuracy / geo_source — how much of a location we actually know
--   3  notifications_milestone_once_idx — the index the code has claimed for
--                                    weeks but that no migration ever created
--   4  analytics_ingest_log        — why a request was or was not counted

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 ── card_events.surface: the card and the Swift Links page are two events
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THE BUG. card_views keys the Swift Links surface as "<slug>__links", so one
-- visitor opening both pages in one visit correctly produces TWO rows there.
-- card_events has no such key — it stores the bare slug — so the visit-bucket
-- unique index below saw the second surface as a duplicate of the first and
-- rejected it. Measured in production 2026-09-09: 11 visits since 2026-08-14
-- produced two card_views rows and only one card_events row. The consequences
-- were all downstream of that missing row:
--
--   • the contact's conversation lost the second surface entirely, permanently
--   • it was labelled by whichever surface happened to fire FIRST, so a visitor
--     who opened the links page and then the card was recorded as a links view
--     and the card view was never recorded at all
--   • the owner's notification named only that first surface
--
-- Nullable, and defaulted through coalesce() in the index rather than on the
-- column: existing rows have no surface and must keep behaving exactly as they
-- did (they were all written by a client that only ever sent one surface per
-- bucket), so treating NULL as 'card' preserves their uniqueness semantics
-- unchanged. A plain NULL-distinct index would instead let history accumulate
-- duplicates it was previously protected from.
ALTER TABLE public.card_events ADD COLUMN IF NOT EXISTS surface text;

-- ── card_events.target: WHICH link, for the new clicked_link event ───────────
-- Swift Links buttons and a card's external links had NO tracking of any kind
-- before this — the only thing a tap did was raise the signup nudge. So an owner
-- could see that their Swift Links page was opened and never which of eight
-- buttons anyone pressed, which is the whole question that page exists to answer.
--
-- Holds the destination HOST ("calendly.com"), not the full URL: the host is
-- what identifies the link to its owner, it is stable when a query string isn't,
-- and a full URL is where tracking parameters and tokens live. It describes the
-- OWNER'S OWN published link, never anything about the visitor.
ALTER TABLE public.card_events ADD COLUMN IF NOT EXISTS target text;

-- The replacement backstop: same race protection, two extra dimensions.
-- Created BEFORE the old one is dropped, so there is no instant in which
-- concurrent duplicate requests are unprotected.
--
-- SURFACE is the fix described above. TARGET matters for the same reason: two
-- taps on two DIFFERENT links in one visit are two events, and an index without
-- it would reject the second as a duplicate of the first — reintroducing the
-- exact bug on the exact day it was fixed. For views and downloads target is
-- NULL, so coalesce('') leaves their behaviour identical.
CREATE UNIQUE INDEX IF NOT EXISTS uq_card_events_visitor_surface_bucket
  ON public.card_events (
    card_owner_username,
    visitor_id,
    event_type,
    coalesce(surface, 'card'),
    coalesce(target, ''),
    public.card_view_bucket(created_at)
  )
  WHERE visitor_id IS NOT NULL AND event_type IN ('viewed_card', 'downloaded_vcard', 'clicked_link')
    AND created_at >= '2026-08-14 00:00:00+00';

-- Now the old one can go: it is the thing that was rejecting the second
-- surface. Dropping a unique index destroys no data and is reversible by
-- re-running view-visit-window.sql.
DROP INDEX IF EXISTS uq_card_events_visitor_bucket;

-- Reading a contact's conversation filters by owner + visitor; surface is only
-- ever read back on rows already fetched, so it needs no index of its own.

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 ── geo_accuracy / geo_source: stop a state-level guess from looking like
--      a city
-- ═══════════════════════════════════════════════════════════════════════════
--
-- request-geo.ts already DECIDES how confident it is — two databases agreeing
-- on a town is a different fact from two databases disagreeing and falling back
-- to the state they share — and then threw that away, storing only a formatted
-- string. Three completely different confidence levels arrived looking
-- identical:
--
--   "Ithaca, NY"      both sources named the town
--   "Great Neck, US"  one source named the town, nothing confirmed it
--   "New York, US"    the sources DISAGREED: somewhere in New York State
--   "US"              country only
--
-- Production, 2026-09-03 → 2026-09-09: 19 of 26 views stored "New York, US".
-- The Locations tab printed that raw and the push said "viewed your card near
-- New York, US" — which every reader takes to mean New York City. It does not.
--
-- The LABEL FORMAT IS DELIBERATELY UNCHANGED. It is the grouping key for the
-- Locations tab and the input to locationAliases(), so re-shaping it would
-- fragment history. Only the confidence travels alongside it, and the display
-- layer composes the two. Rows with a NULL accuracy (all history) render
-- exactly as they do today.
--
-- geo_accuracy: 'city' | 'city_approx' | 'region' | 'country'  (NULL = legacy)
-- geo_source:   'edge+second' | 'edge' | 'second'              (NULL = legacy)
ALTER TABLE public.card_views  ADD COLUMN IF NOT EXISTS geo_accuracy text;
ALTER TABLE public.card_views  ADD COLUMN IF NOT EXISTS geo_source   text;
ALTER TABLE public.card_events ADD COLUMN IF NOT EXISTS geo_accuracy text;
ALTER TABLE public.card_events ADD COLUMN IF NOT EXISTS geo_source   text;
-- leads.location is the same IP-derived guess, shown in the contact panel as
-- plain fact ("New York, US" under a map pin, beside a real phone number the
-- person typed in themselves). It needs the same qualifier for the same reason:
-- the details on that panel are things the contact TOLD us, and the location is
-- the one line that is inferred.
ALTER TABLE public.leads       ADD COLUMN IF NOT EXISTS geo_accuracy text;

-- ── card_views.ip: the dormant column ───────────────────────────────────────
-- NOT DROPPED, deliberately. It is NULL in all 229 production rows (verified
-- 2026-09-09) and no application code has written it for months, so there is
-- no privacy exposure to remediate — but dropping a column is the one category
-- of migration this project does not do without the owner saying so, and an
-- unused NULL column costs nothing. A comment is left on it instead so the next
-- person does not mistake it for a field that is supposed to be populated.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'card_views' AND column_name = 'ip'
  ) THEN
    COMMENT ON COLUMN public.card_views.ip IS
      'DEAD COLUMN — never write this. Raw IPs are never persisted (privacy policy); the IP is a rate-limit key and a geo lookup input only. NULL in 100% of rows. Kept rather than dropped to avoid a destructive migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 ── notifications_milestone_once_idx: the index the code already relies on
-- ═══════════════════════════════════════════════════════════════════════════
--
-- lib/milestones.ts says, in a comment: "The notifications_milestone_once_idx
-- unique index is the real ledger — whoever loses that race gets no row back."
-- That index exists in no migration in this repository. The check-then-insert
-- in front of it is a TOCTOU window, so two views committing either side of a
-- milestone boundary could both announce it. Production has no such duplicate
-- yet (7 milestone rows, 0 duplicate (card_owner, type) pairs) — the volume
-- simply has not produced the race.
--
-- Partial on the milestone types only, so ordinary notifications are untouched.
-- card_owner is nullable on history, and a NULL card_owner would make the index
-- useless for those rows; the app's fallback path already dedupes per-user when
-- the column is missing, and every row written since notifications-card-scope
-- carries it.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_milestone_once_idx
  ON public.notifications (card_owner, type)
  WHERE card_owner IS NOT NULL AND type LIKE 'milestone_%';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 ── analytics_ingest_log: why a request was, or was not, counted
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The pipeline makes a series of honest decisions — bot, prefetch, owner's own
-- visit, same-visit reload, card not live, rate limited — and then DISCARDS
-- every request it declines. So "why is this view missing?" and "is that view
-- real?" were both unanswerable, and the only way to judge the classifier was
-- to argue about it.
--
-- Shaped exactly like push_log and error_events, which are the two precedents
-- in this project for a small, self-trimming, service-role-only decision log:
-- short retention, RLS on, writes bypass RLS via the service role, reads are
-- the owner's own or nobody's. It is NOT a second analytics pipeline and no
-- customer-facing number is ever computed from it — card_views remains the one
-- source of counted truth. This records the DECISION, not the traffic.
create table if not exists public.analytics_ingest_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- What was touched. entity_key is the card_views key ("<slug>" or
  -- "<slug>__links") so a row here joins straight onto the counted table.
  product       text not null,              -- 'swiftcard' | 'swiftlinks'
  entity_key    text not null,
  event_type    text not null,              -- 'viewed_card' | 'downloaded_vcard' | 'clicked_link'
  surface       text,                        -- 'card' | 'links'

  -- The decision.
  counted       boolean not null,
  reason        text not null,              -- 'recorded' | 'deduped' | 'self' | 'inactive'
                                            -- | 'bot' | 'prefetch' | 'rate_limited'
                                            -- | 'error' | 'surface_collision'
  classification      text,                 -- 'human' | 'crawler' | 'automation' | 'monitor'
                                            -- | 'http_client' | 'datacenter'
  classification_reason text,               -- the signal that fired, never the raw UA

  -- Context, all of it already derived on the request — none of it new work.
  source        text,
  identity_level text,                       -- 'confirmed' | 'associated' | 'anonymous'
  geo_accuracy  text,
  geo_source    text,
  is_relay      boolean,
  notified      text,                        -- 'created' | 'upgraded' | 'suppressed'
                                            -- | 'failed' | 'not_eligible' | null

  -- A visitor is pseudonymous here exactly as in card_views: the browser id,
  -- never an IP and never a hash of one. visit_key ties a row to the
  -- notification ledger so one visit can be read end to end.
  visitor_id    text,
  visit_key     text
);

-- The two questions this table is for: "what happened on this card recently"
-- and "show me everything in this visit".
create index if not exists analytics_ingest_log_entity_idx
  on public.analytics_ingest_log (entity_key, created_at desc);
create index if not exists analytics_ingest_log_recent_idx
  on public.analytics_ingest_log (created_at desc);
create index if not exists analytics_ingest_log_visit_idx
  on public.analytics_ingest_log (visit_key)
  where visit_key is not null;

alter table public.analytics_ingest_log enable row level security;

-- RLS on with NO POLICIES: anon and authenticated see nothing at all, the
-- service role bypasses it by design. Same stance as card_views. The admin
-- surface that reads this goes through the service role behind an isAdminEmail
-- check, exactly like /api/admin/analytics. Deliberately not even an
-- "own rows" policy — these rows belong to no user.

-- Self-trimming, like push_log and error_events. This is a debugging signal
-- with a two-week memory, not an archive — and keeping it short is also what
-- keeps it from becoming a shadow analytics store someone is tempted to count.
delete from public.analytics_ingest_log where created_at < now() - interval '14 days';
