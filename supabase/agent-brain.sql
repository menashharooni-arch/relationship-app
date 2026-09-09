-- ── Agent Flow: the BRAIN (owner order 2026-09-08) ───────────────────────────
-- Run AFTER supabase/agent-flow.sql, in the Supabase SQL editor. Idempotent;
-- safe to re-run.
--
-- "All my agents should have a brain like that": every agent first researches
-- its own role (how often to work, what works, what doesn't), then on each shift
-- researches exactly what to make TODAY, writes TWO complete options that both
-- sway people towards SwiftCard, and the owner picks one — which posts.
--
-- Same rules as the rest of Agent Flow: these tables are the agents' only write
-- surface, RLS on with no policies (service-role only), nothing touches product
-- tables or user data.

-- ── 1. Playbooks: what each agent learned about its own job ──────────────────
-- Refreshed by the agent itself about once a week (one research call), so the
-- way it works keeps up with the platforms it works on.
create table if not exists agent_playbooks (
  agent_id       text primary key,
  cadence        text,            -- the rhythm the research recommends, in schedule grammar (daily@09:00, weekly@mon,wed@09:00, every@6h)
  summary        text,            -- 3-5 plain lines: how this role is done well right now
  best_practices jsonb,           -- [string]
  pitfalls       jsonb,           -- [string]
  channels       jsonb,           -- [string] where the work lands / who it reaches
  sources        jsonb,           -- [{title,url}] what the research was based on
  researched_at  timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Where a settings row's `schedule` came from, so the playbook can set a rhythm
-- without ever overwriting one the owner chose by hand.
--   default  = nothing set, clocks use config.json's default_schedule
--   playbook = written by the agent's own role research
--   owner    = set from the Agent Flow tab; the playbook never touches it
alter table agent_settings add column if not exists schedule_source text not null default 'default';

-- ── 2. Requests: one agent asking another for work ───────────────────────────
-- e.g. Milo (social) → Vince (video): "a 20s vertical clip of a realtor tapping
-- a card at an open house". The receiving agent sees its open requests at the
-- top of its next shift and answers them first. Linked both ways to the queue
-- so the owner can follow the thread.
create table if not exists agent_requests (
  id           uuid primary key default gen_random_uuid(),
  from_agent   text not null,
  to_agent     text not null,
  kind         text not null,             -- video | image | copy | research | data
  brief        text not null,             -- what is wanted, in one paragraph
  for_item     uuid references agent_queue_items(id) on delete set null,   -- the work that needs it
  status       text not null default 'open',   -- open | fulfilled | declined
  fulfilled_by uuid references agent_queue_items(id) on delete set null,   -- the answer
  created_at   timestamptz not null default now(),
  fulfilled_at timestamptz
);
create index if not exists agent_requests_to_idx on agent_requests (to_agent, status, created_at desc);

-- ── 3. Competitor watch (Cleo) ───────────────────────────────────────────────
-- The watching is code (fetch + hash, no tokens); the thinking is on-demand.
-- A page whose fingerprint changed is what wakes the LLM to read the diff and
-- write it up. `discovered` rows come from Cleo's own weekly sweep for
-- competitors nobody listed by hand.
create table if not exists agent_competitors (
  id          text primary key,           -- 'blinq' | 'hihello' | …
  name        text not null,
  site        text not null,
  pages       jsonb not null default '[]'::jsonb,  -- [{key:'pricing', url}] the pages watched
  app_store   text,                       -- App Store URL, watched for version bumps
  discovered  boolean not null default false,
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists agent_competitor_snapshots (
  id            uuid primary key default gen_random_uuid(),
  competitor_id text not null references agent_competitors(id) on delete cascade,
  page_key      text not null,
  url           text not null,
  hash          text not null,            -- sha256 of the visible text
  excerpt       text,                     -- first ~6k chars of visible text, so a diff can be read later
  fetched_at    timestamptz not null default now()
);
create index if not exists agent_competitor_snapshots_idx on agent_competitor_snapshots (competitor_id, page_key, fetched_at desc);

insert into agent_competitors (id, name, site, pages, app_store) values
  ('blinq',   'Blinq',   'https://blinq.me',        '[{"key":"pricing","url":"https://blinq.me/pricing"},{"key":"home","url":"https://blinq.me"}]',            'https://apps.apple.com/us/app/blinq-digital-business-card/id1324102258'),
  ('hihello', 'HiHello', 'https://www.hihello.com', '[{"key":"pricing","url":"https://www.hihello.com/pricing"},{"key":"home","url":"https://www.hihello.com"}]', 'https://apps.apple.com/us/app/hihello-digital-business-card/id1417587542'),
  ('popl',    'Popl',    'https://popl.co',         '[{"key":"pricing","url":"https://popl.co/pages/pricing"},{"key":"home","url":"https://popl.co"}]',          'https://apps.apple.com/us/app/popl-digital-business-card/id1471342185'),
  ('linq',    'Linq',    'https://linqapp.com',     '[{"key":"pricing","url":"https://linqapp.com/pricing"},{"key":"home","url":"https://linqapp.com"}]',        'https://apps.apple.com/us/app/linq-digital-business-card/id1476565290'),
  ('mobilo',  'Mobilo',  'https://www.mobilocard.com', '[{"key":"pricing","url":"https://www.mobilocard.com/pricing"},{"key":"home","url":"https://www.mobilocard.com"}]', null),
  ('wave',    'Wave',    'https://wavecnct.com',    '[{"key":"pricing","url":"https://wavecnct.com/pages/pricing"},{"key":"home","url":"https://wavecnct.com"}]', null),
  ('linktree','Linktree','https://linktr.ee',       '[{"key":"pricing","url":"https://linktr.ee/s/pricing/"},{"key":"home","url":"https://linktr.ee"}]',          null)
on conflict (id) do nothing;

-- ── 4. Media pool (Vince) ────────────────────────────────────────────────────
-- Referenced by lib/media-pool.mjs and src/lib/agent-execute.ts (Higgsfield
-- jobs land here and Milo/Addy reuse the rendered asset). Defined here so a
-- fresh database has it.
create table if not exists media_assets (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,             -- image | video
  prompt       text,
  provider     text not null default 'higgsfield',
  provider_job text,
  status_url   text,
  status       text not null default 'pending',   -- pending | ready | failed
  url          text,
  error        text,
  concept      text,
  source_item  uuid references agent_queue_items(id) on delete set null,
  source_agent text,
  created_at   timestamptz not null default now(),
  ready_at     timestamptz
);
create index if not exists media_assets_status_idx on media_assets (status, created_at desc);

alter table agent_playbooks            enable row level security;
alter table agent_requests             enable row level security;
alter table agent_competitors          enable row level security;
alter table agent_competitor_snapshots enable row level security;
alter table media_assets               enable row level security;

-- ── 6. Settings rows for the 2026-09-08 expansion ────────────────────────────
-- agent-flow.sql seeds these too, but that file was run before these agents
-- existed. No row = the agent is invisible on the tab and its runs fail. Both
-- the tab and the runner now self-heal missing rows; this is the same seed for
-- anyone running SQL by hand. New rows start rested, like every worker after
-- Start.
insert into agent_settings (agent_id, enabled, paused, output_cap) values
  ('video',        true, true, 6),
  ('email',        true, true, 2),
  ('cro',          true, true, 2),
  ('competitors',  true, true, 6),
  ('industry',     true, true, 12),
  ('forums',       true, true, 8),
  ('partners',     true, true, 6),
  ('listings',     true, true, 6),
  ('reviews',      true, true, 6),
  ('support',      true, true, 4),
  ('retention',    true, true, 2)
on conflict (agent_id) do nothing;

-- ── 7. The 2026-09-08 second wave ────────────────────────────────────────────
-- Theo's strategy team (Ana, Tara, Axel, Gia, Lena, Rae, Piper), Lou for
-- local, Nina's lifecycle agents (Ollie, Uma, Cass, Pat), and Rex's servicing
-- watch (Cara, Lyn, Penny, Della, Ren, Dex, Dana, Ash, Pix) plus Cody.
-- Same rule as §6: rows start rested; the owner wakes teams from the tab.
insert into agent_settings (agent_id, enabled, paused, output_cap) values
  ('analyst',        true, true, 3),
  ('trends',         true, true, 4),
  ('aso',            true, true, 3),
  ('geo',            true, true, 3),
  ('launch',         true, true, 3),
  ('referral',       true, true, 3),
  ('pr',             true, true, 6),
  ('local',          true, true, 6),
  ('onboarding',     true, true, 3),
  ('upsell',         true, true, 3),
  ('churn',          true, true, 3),
  ('proof',          true, true, 4),
  ('cards',          true, true, 5),
  ('links',          true, true, 5),
  ('payments',       true, true, 5),
  ('deliverability', true, true, 5),
  ('renewals',       true, true, 3),
  ('deps',           true, true, 5),
  ('data',           true, true, 5),
  ('appstore',       true, true, 5),
  ('layout',         true, true, 5),
  ('compliance',     true, true, 4)
on conflict (agent_id) do nothing;

-- The owner's one-line focus for the week ("this week: realtors and the
-- referral program"). Every LLM agent reads it before anything else.
alter table agent_system add column if not exists weekly_focus text;

-- Cody's memory: the last hash + excerpt of every policy page he watches
-- (Apple review guidelines, Google OAuth policy, Twilio A2P, GDPR/CCPA…).
-- Code does the diffing; the model only reads a change that already happened.
create table if not exists agent_page_snapshots (
  id          uuid primary key default gen_random_uuid(),
  source_key  text not null,
  url         text not null,
  hash        text not null,
  excerpt     text,
  fetched_at  timestamptz not null default now()
);
create index if not exists agent_page_snapshots_key_idx on agent_page_snapshots (source_key, fetched_at desc);
alter table agent_page_snapshots enable row level security;
