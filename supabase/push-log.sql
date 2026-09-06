-- Every push decision, on every plan, with its outcome.
--
-- Two jobs:
--   1. PROOF. The daily cap and the hourly first-view batch are counted from
--      this table, so it is not just observability — sends read it.
--   2. EVIDENCE. `plan` is recorded on every row precisely so we can show that
--      Free, trial, Pro and Office are treated identically. Nothing in the code
--      branches on it.
--
-- Outcomes: sent, failed, category_off, quiet_hours, daily_cap, batched,
-- no_subscription, no_deliverable_endpoint.
--
-- Safe to re-run.

create table if not exists public.push_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null,
  plan        text,
  outcome     text not null,
  endpoints   int default 0,
  created_at  timestamptz not null default now()
);

-- The hot path: "how many capped pushes has this person had in the last 24h"
-- and "when was their last first_view push". Both are (user, category, time).
create index if not exists push_log_user_created_idx
  on public.push_log (user_id, created_at desc);
create index if not exists push_log_user_cat_created_idx
  on public.push_log (user_id, category, created_at desc);

alter table public.push_log enable row level security;

-- Writes come from the service role only (lib/push.ts), which bypasses RLS.
-- A person may read their own history; nobody may write through the anon key.
drop policy if exists "own push log" on public.push_log;
create policy "own push log" on public.push_log
  for select using (auth.uid() = user_id);

-- Housekeeping: the cap only ever looks back 24 hours, so anything older is
-- history, not state. Trim it so the table cannot grow without bound.
delete from public.push_log where created_at < now() - interval '30 days';
