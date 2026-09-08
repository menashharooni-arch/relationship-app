-- Agent Flow: the company group chat (owner order 2026-09-08).
-- One room, the owner and every agent in it. The owner @-mentions who he
-- wants; each mentioned agent takes a chat turn (a direct run) and replies.
-- Run this once in the Supabase SQL editor. Service role only — no policies.

create table if not exists public.agent_chat (
  id          uuid primary key default gen_random_uuid(),
  from_id     text not null,                      -- 'owner' or an org party id (jake, maya, atlas …)
  kind        text not null default 'message' check (kind in ('message', 'reply', 'system')),
  body        text not null,
  mentions    text[] not null default '{}',       -- responder ids this message is addressed to
  reply_to    uuid references public.agent_chat(id) on delete set null,
  run_id      uuid references public.agent_runs(id) on delete set null,
  payload     jsonb not null default '{}'::jsonb, -- { items: [], fixes: [], delegated: [], run_now, note }
  created_at  timestamptz not null default now()
);
create index if not exists agent_chat_created_idx on public.agent_chat (created_at desc);

-- One row per (message, responder): who still owes a reply, who is working
-- on it, who answered. The Chat tab reads these for the status chips; the
-- watchdog re-dispatches anything left 'waiting' too long.
create table if not exists public.agent_chat_orders (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.agent_chat(id) on delete cascade,
  responder   text not null,                      -- agent_id (seo, manager …) or a lead's party id (maya …)
  status      text not null default 'waiting' check (status in ('waiting', 'working', 'done', 'failed')),
  reply_id    uuid references public.agent_chat(id) on delete set null,
  run_id      uuid references public.agent_runs(id) on delete set null,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (message_id, responder)
);
create index if not exists agent_chat_orders_status_idx on public.agent_chat_orders (status, created_at);

alter table public.agent_chat enable row level security;
alter table public.agent_chat_orders enable row level security;
