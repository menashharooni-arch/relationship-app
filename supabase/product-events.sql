-- ── First-party product events (the click funnel) ───────────────────────────
--
-- WHY: lib/events.ts has had a full event vocabulary since it was written, and
-- every call to track() was a no-op in production. PostHog was never
-- configured — swiftcard.me ships no PostHog at all — so "how many people start
-- a card, finish it, look at pricing, click upgrade" was unanswerable. The one
-- dashboard used to judge the business (/admin/analytics) could only count rows
-- that already existed: accounts, cards, leads, views. Everything BEFORE the
-- signup was invisible.
--
-- This is that missing half, kept in our own database rather than a third
-- party's: it lands in the same admin page as everything else, costs nothing,
-- needs no new account, and cannot be blocked by an ad-blocker the way a
-- third-party analytics script is.
--
-- PRIVACY: no IP address, no User-Agent, no email, no name — see the ingest
-- route, which allow-lists the property keys and drops the rest. `session_key`
-- is a random per-visit id from sessionStorage, not a person id, and it dies
-- with the browser tab.

create table if not exists product_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- One of lib/events.ts EVENTS. Validated at ingest against that closed list,
  -- so a typo'd or forged name never reaches this table.
  name        text not null,
  -- Allow-listed, low-cardinality props: placement, cta, plan, interval,
  -- feature, method, variant, seats. Never an id belonging to a person.
  props       jsonb not null default '{}'::jsonb,
  -- Groups the steps of ONE visit together so a funnel can be counted per
  -- visit rather than per event. Random, per-tab, never joined to a user.
  session_key text,
  -- The route the event fired on ("/pricing"), path only — no query string,
  -- which is where campaign ids and emails end up.
  path        text,
  -- Our own traffic: an admin session, the App Review demo account, or a
  -- browser that has been marked internal once. Kept rather than dropped so
  -- the admin page can show real-vs-internal instead of quietly hiding rows.
  is_internal boolean not null default false
);

create index if not exists product_events_recent_idx on product_events (created_at desc);
create index if not exists product_events_name_idx on product_events (name, created_at desc);
-- The funnel query is "real traffic, last 30 days, grouped by name".
create index if not exists product_events_funnel_idx on product_events (is_internal, created_at desc);

-- Service-role only. The anon key must never read the funnel, and nothing
-- client-side needs to: the browser only ever WRITES, through the ingest route.
alter table product_events enable row level security;

-- 90-day retention: long enough to compare this month with the last two,
-- short enough that the table never becomes an archive nobody prunes.
create or replace function prune_product_events() returns void
language sql
security definer
set search_path = 'public'
as $$
  delete from product_events where created_at < now() - interval '90 days';
$$;
