-- Per-card scoping for CRM + Zapier destinations.
-- APPLIED to production 2026-08-05 via Supabase MCP (migration name: crm_card_scope).
-- Kept here so the schema history lives in the repo alongside the others.
--
-- Problem: integrations are keyed (user_id, provider) and the Zapier webhook is a
-- single column on profiles, so EVERY card on an account fed the same destination.
-- Someone with a personal card and an employer card had their personal contacts
-- written into the employer's CRM.
--
-- NULL is the whole compatibility story: it means "all cards", which is exactly
-- what these integrations did before. No backfill, no default, so every existing
-- row keeps behaving identically the moment this lands. A non-empty array means
-- "only these cards". The application treats an unknown/absent card id as
-- OUT of scope whenever a scope is set (fail closed) — the point of the feature
-- is preventing a leak, so "not provably in scope" must not send.
alter table public.integrations
  add column if not exists card_ids uuid[];

alter table public.profiles
  add column if not exists zapier_card_ids uuid[];

comment on column public.integrations.card_ids is
  'Cards whose leads sync to this CRM connection. NULL = all cards (default, and the pre-existing behavior). Non-empty = only these card ids. Not a FK (uuid[]); a deleted card simply stops matching.';

comment on column public.profiles.zapier_card_ids is
  'Cards whose leads and events fire the Zapier webhook. NULL = all cards (default, and the pre-existing behavior). Non-empty = only these card ids.';
