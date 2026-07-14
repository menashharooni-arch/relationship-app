-- Office roles (spec §6/§7). SAFE, ADDITIVE migration — adds one nullable column
-- with a default; never drops/rewrites data, so it cannot break existing offices,
-- members, or invitations.
--
-- Run in the Supabase SQL editor. Until run, the app treats a missing role as
-- 'employee' and the office OWNER always has every capability, so behavior is
-- exactly as today (owner-only) — no breakage either way.
--
-- Rollback: alter table office_members drop column if exists role;

alter table if exists public.office_members
  add column if not exists role text not null default 'employee';

-- Roles the app assigns to MEMBERS: 'admin' | 'manager' | 'billing_admin' | 'employee'.
-- The office OWNER is implicit (offices.owner_id) and is not a member row — the
-- owner has all capabilities and is never assigned a member role.

-- Backfill: any existing active members default to 'employee' (the column default
-- already handles new rows; this is explicit for clarity / re-runs).
update public.office_members set role = 'employee' where role is null;

create index if not exists office_members_role_idx on public.office_members (office_id, role);
