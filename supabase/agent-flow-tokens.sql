-- Token-denominated caps (owner order 2026-09-02: the system runs on the
-- Claude plan — usage and tokens, not dollars). Run once in the Supabase SQL
-- editor. The old *_usd columns stay for history; code no longer reads them
-- for gating. Defaults match the code's fallbacks (agentkit.mjs).
alter table agent_settings add column if not exists usage_cap_tokens bigint not null default 500000;
alter table agent_system  add column if not exists monthly_usage_cap_tokens bigint not null default 6000000;
notify pgrst, 'reload schema';
