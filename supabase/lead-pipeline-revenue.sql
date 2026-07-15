-- ── Lead pipeline + revenue attribution ─────────────────────────────────────
-- Run ONCE in the Supabase SQL Editor (Supabase → SQL Editor → New query →
-- paste → Run). Additive and idempotent — safe to re-run.
--
-- Until it is run, the app degrades gracefully and does NOT error:
--   • the Office Leads tab keeps working off leads.status (New / Contacted /
--     Closed / Not interested) exactly as it does today;
--   • the Pipeline and Won revenue tiles stay HIDDEN, because they only render
--     when real values exist — never as zeroes.
--
-- Rollback:
--   alter table public.leads   drop column if exists stage;
--   alter table public.leads   drop column if exists deal_value_cents;
--   alter table public.leads   drop column if exists won_value_cents;
--   alter table public.leads   drop column if exists stage_updated_at;
--   alter table public.offices drop column if exists avg_customer_value_cents;

-- ── 1. Pipeline stage ───────────────────────────────────────────────────────
-- Deliberately a NEW column rather than overloading leads.status.
--
-- `status` is the PERSONAL contacts cycle (new_contact | touch | dissolved |
-- not_interested) that LeadCard/ContactsClient read and tap to cycle. `stage` is
-- the ORG sales pipeline and carries money. They are genuinely different things
-- — one card owner's "touch" is not a business's "qualified" — and overloading
-- one column would break the personal flow the moment Office wrote "booked".
--
-- No CHECK constraint: every other status-ish column in this schema is plain
-- text (leads.status, office_members.status), the app validates the value, and
-- a CHECK would hard-fail any older client posting an unknown stage.
alter table if exists public.leads
  add column if not exists stage text;

-- Estimated value while the deal is open, in INTEGER CENTS (never float dollars
-- — see lib/currency.ts). NULL means "not entered", which is different from 0:
-- only non-null values count as REAL figures. Everything else is an estimate.
alter table if exists public.leads
  add column if not exists deal_value_cents integer;

-- What the deal actually closed for. Separate from deal_value_cents on purpose:
-- "we hoped for $5k" and "we banked $3k" must not be the same number, or Won
-- revenue silently reports the forecast.
alter table if exists public.leads
  add column if not exists won_value_cents integer;

alter table if exists public.leads
  add column if not exists stage_updated_at timestamptz;

-- ── 2. Org-level average customer value ─────────────────────────────────────
-- Optional. When set, leads with no explicit value are ESTIMATED at this
-- amount, and every figure derived from it is labelled an estimate in the UI.
alter table if exists public.offices
  add column if not exists avg_customer_value_cents integer;

-- ── 3. Indexes ──────────────────────────────────────────────────────────────
-- Guarded: these tables have no CREATE TABLE in this repo, so on a fresh DB they
-- may legitimately not exist yet.
do $$
begin
  if to_regclass('public.leads') is not null then
    create index if not exists idx_leads_card_owner_created
      on public.leads (card_owner, created_at desc);
    -- Partial: the pipeline views only ever ask for leads that HAVE a stage.
    create index if not exists idx_leads_stage
      on public.leads (card_owner, stage) where stage is not null;
  end if;
end $$;

-- ── 4. Backfill ─────────────────────────────────────────────────────────────
-- Every existing lead gets a stage derived from the status it already has, so
-- the funnel's first stage matches the lead count instead of silently dropping
-- every lead captured before this migration.
update public.leads set stage =
  case
    when status = 'touch'          then 'contacted'
    when status = 'dissolved'      then 'lost'
    when status = 'not_interested' then 'lost'
    else 'new'
  end
where stage is null;
