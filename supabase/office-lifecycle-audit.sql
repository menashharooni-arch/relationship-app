-- Office invitation lifecycle + audit log (spec §4, §11, §12, §13).
--
-- SAFE, ADDITIVE migration. It only ADDs a column and a table — it never drops,
-- renames, or rewrites existing data, so running it cannot break existing
-- offices, members, invitations, subscriptions, or analytics.
--
-- Run this in the Supabase SQL editor. Until it is run:
--   • invitation expiry falls back to created_at + 7 days (existing behavior),
--   • audit writes fail OPEN (best-effort insert; a missing table is ignored),
-- so the app keeps working either way.
--
-- Rollback: `alter table office_members drop column if exists expires_at;`
--           `drop table if exists audit_logs;`

-- 1) Persist an explicit invitation expiry (previously computed from created_at).
alter table if exists public.office_members
  add column if not exists expires_at timestamptz;

-- office_members.status is a plain text column. No enum change is needed — the
-- app now also writes 'revoked', 'declined', and 'expired' in addition to the
-- existing 'pending' / 'active'. (Documented here for reviewers.)

-- 2) Append-only audit log for billing, seat, invitation, member, role, and
--    company-card changes (spec §11/§12).
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,                 -- who performed the action (auth user id), null for system/webhook
  org_id      uuid,                 -- the office it relates to, when applicable
  target_id   text,                 -- id/email of the affected entity (member, invite, subscription…)
  action      text not null,        -- e.g. 'invite.created', 'member.removed', 'seat.changed', 'plan.changed'
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_org_idx on public.audit_logs (org_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- Service-role only; never exposed to clients directly.
alter table public.audit_logs enable row level security;
