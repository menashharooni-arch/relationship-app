-- ── Durable home for production errors ──────────────────────────────────────
--
-- WHY: reportError wrote to two places, neither of which anything could read
-- back. console.error lands in Vercel's log stream, which is ephemeral and only
-- reachable with a Vercel API token; ALERT_WEBHOOK_URL was never set. So the
-- app knew about every crash and could tell nobody.
--
-- That is what made Bo (bugwatch) blind: he had no queryable source of truth
-- for "what is breaking right now", so he needed a Vercel token just to see
-- what the app already knew. With this table he reads crashes using the
-- Supabase service key every agent already holds — no new credential, and the
-- errors are retained and queryable instead of scrolling away.
--
-- Deliberately small and self-trimming: this is an alerting signal, not an
-- archive. Keep 14 days.

create table if not exists error_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  context     text not null,              -- 'stripe-webhook' | 'client:/dashboard' | …
  message     text not null,
  stack       text,
  env         text not null default 'production',  -- production | preview | development
  -- Stable grouping key so N occurrences of one bug are one incident, matching
  -- how the watchdog dedupes findings.
  fingerprint text not null,
  extra       jsonb
);

create index if not exists error_events_recent_idx on error_events (created_at desc);
create index if not exists error_events_fingerprint_idx on error_events (fingerprint, created_at desc);

-- Service-role only, like every other agent table: the anon key must never be
-- able to read production stack traces, and nothing client-side needs to.
alter table error_events enable row level security;

-- 14-day retention. Called opportunistically by the writer (cheap, indexed).
create or replace function prune_error_events() returns void
language sql
security definer
set search_path = 'public'
as $$
  delete from error_events where created_at < now() - interval '14 days';
$$;
