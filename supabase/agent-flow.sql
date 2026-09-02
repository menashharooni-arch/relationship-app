-- ── Agent Flow: marketing/monitoring agent system tables ─────────────────────
-- NOT YET APPLIED. Presented for owner review first (his explicit gate), then
-- run in the Supabase SQL editor. Idempotent throughout; safe to re-run.
--
-- Design rules, mirroring the rest of the schema:
--   • These tables are the agents' ONLY write surface — nothing here touches
--     profiles/cards/leads or any product table (owner constraint: additive).
--   • RLS ON with NO policies = service-role only. The Agent Flow admin tab
--     reads/writes through /api/admin/* routes (requireAdmin + admin client),
--     and the GitHub Actions agents use the service key. No end-user client
--     can ever read or write agent data.

-- Per-agent settings, editable from the Agent Flow tab without a deploy.
create table if not exists agent_settings (
  agent_id     text primary key,          -- 'outreach' | 'prospects' | 'seo' | 'blog' | 'social' | 'mentions' | 'influencer' | 'bugwatch' | 'security' | 'manager'
  enabled      boolean not null default true,
  paused       boolean not null default false,  -- per-agent pause; checked between steps
  output_cap   integer not null default 15,     -- max queue items per run
  usage_cap_usd numeric(8,2) not null default 2.00,  -- per-run LLM spend cap
  schedule     text,                      -- cron, e.g. '0 7 * * *'; NULL = manual-only (default)
  updated_at   timestamptz not null default now()
);

-- One-row system state: the master pause flag + global caps.
create table if not exists agent_system (
  id                   boolean primary key default true check (id), -- singleton
  paused               boolean not null default false,   -- PAUSE ALL
  monthly_usage_cap_usd numeric(8,2) not null default 25.00,
  digest_email         text not null default 'hello@swiftcard.me',
  updated_at           timestamptz not null default now()
);
insert into agent_system (id) values (true) on conflict do nothing;

-- Work-hours auto-stop: when set and reached, the whole system behaves as
-- paused (agents stop at their next checkpoint; nothing new starts) until the
-- owner clears it from the Agent Flow tab.
alter table agent_system add column if not exists auto_pause_at timestamptz;

-- Every run of every agent, for the status board and the audit trail.
create table if not exists agent_runs (
  id           uuid primary key default gen_random_uuid(),
  agent_id     text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running',  -- running | success | failed | paused | skipped_cap | skipped_disabled
  output_count integer not null default 0,
  usage_usd    numeric(8,4) not null default 0,
  usage_tokens bigint not null default 0,
  trigger      text not null default 'manual',   -- manual | start_all | schedule
  gh_run_id    text,                             -- link back to the Actions run
  summary      text,                             -- what it did / skipped / failed on
  error        text
);
create index if not exists agent_runs_agent_idx on agent_runs (agent_id, started_at desc);

-- The review queue: every draft/finding/report from every agent, one list.
create table if not exists agent_queue_items (
  id          uuid primary key default gen_random_uuid(),
  agent_id    text not null,
  run_id      uuid references agent_runs(id) on delete set null,
  item_type   text not null,   -- outreach_draft | prospect | reply_draft | influencer | video_script | blog_post | seo_report | security_finding | perf_finding | digest | generic
  platform    text,            -- reddit | linkedin | instagram | facebook | x | quora | forum | blog | site | repo
  target      text,            -- person/thread/keyword/file the item is about
  target_url  text,
  title       text not null,
  content     text,            -- the FULL drafted message/post/script
  context     text,            -- what they posted/asked; why this was surfaced
  status      text not null default 'pending',
    -- pending | approved | rejected | edited | contacted | replied | converted | published | acknowledged
  payload     jsonb,           -- type-specific extras (follower counts, csv row, pr url, keyword data…)
  dedupe_key  text,            -- stable key (e.g. platform:handle, thread url) — blocks re-surfacing
  created_at  timestamptz not null default now(),
  actioned_at timestamptz
);
create unique index if not exists agent_queue_dedupe_idx
  on agent_queue_items (agent_id, dedupe_key) where dedupe_key is not null;
create index if not exists agent_queue_status_idx on agent_queue_items (status, created_at desc);

-- What the owner did with each item — the accountability ledger.
create table if not exists agent_action_history (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid references agent_queue_items(id) on delete cascade,
  action       text not null,        -- approved | rejected | edited | published | contacted | acknowledged | csv_downloaded
  actor_email  text not null,
  edit_before  text,
  edit_after   text,
  outcome      text,                 -- reply | signup | conversion … (filled in later by hand or by agents)
  created_at   timestamptz not null default now()
);
create index if not exists agent_history_item_idx on agent_action_history (item_id);

-- Agent 4's topic log: never two posts on one topic.
create table if not exists agent_blog_topics (
  topic       text primary key,      -- normalized topic key
  slug        text not null,
  title       text not null,
  status      text not null default 'drafted',  -- drafted | published | rejected
  item_id     uuid references agent_queue_items(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Published blog posts (Agent 4). The public /blog pages read ONLY rows with
-- status='published' via the server admin client — service-role, no user path.
create table if not exists agent_blog_posts (
  slug         text primary key,
  title        text not null,
  description  text not null,           -- meta description
  keyword      text,                    -- target keyword
  content_md   text not null,           -- markdown body
  og_title     text,
  status       text not null default 'draft',   -- draft | published
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- The company chat log: every dispatch, report-back, and escalation between
-- the owner, Atlas (chief of staff), the team leads, and the workers. Rows are
-- written ONLY at real lifecycle moments (a dispatch that actually happened, a
-- run that actually finished) — the feed is an audit trail, not decoration.
-- Party ids come from marketing-agents/org.json; 'all' = broadcast.
create table if not exists agent_messages (
  id         uuid primary key default gen_random_uuid(),
  from_id    text not null,   -- org.json party id, or 'owner'
  to_id      text not null,   -- org.json party id, 'owner', or 'all'
  kind       text not null default 'a2a',  -- a2a | owner_in (owner → company) | owner_out (company → owner)
  body       text not null,
  run_id     uuid references agent_runs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_created_idx on agent_messages (created_at desc);

-- Service-role only: RLS on, no policies.
alter table agent_messages       enable row level security;
alter table agent_blog_posts     enable row level security;
alter table agent_settings       enable row level security;
alter table agent_system         enable row level security;
alter table agent_runs           enable row level security;
alter table agent_queue_items    enable row level security;
alter table agent_action_history enable row level security;
alter table agent_blog_topics    enable row level security;

-- Seed one settings row per agent (idempotent).
insert into agent_settings (agent_id, output_cap, usage_cap_usd) values
  ('outreach',   12, 2.00),
  ('prospects',  40, 2.00),
  ('seo',         5, 1.50),
  ('blog',        2, 3.00),
  ('social',      5, 2.00),
  ('mentions',   10, 2.00),
  ('influencer', 10, 2.00),
  ('bugwatch',    5, 3.00),
  ('security',   10, 2.00),
  ('perf',        3, 0.50),
  ('manager',     1, 1.00)
on conflict (agent_id) do nothing;
