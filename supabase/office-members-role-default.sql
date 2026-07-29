-- office_members.role: align the column default with the app's role vocabulary.
--
-- APPLIED to production 2026-07-29 via Supabase apply_migration
-- (office_members_role_default_employee). Kept here so the repo stays the
-- source of truth and a rebuilt environment matches.
--
-- The column defaulted to 'member', which is NOT one of the roles the
-- application knows:
--
--     OfficeRole = owner | admin | manager | billing_admin | employee
--
-- The invite route never set a role, so every invited sub-user was stored as
-- 'member'. resolveOfficeContext (src/lib/office-roles.ts) coerces any
-- unrecognised role to 'employee', so behaviour was correct and nothing leaked
-- — but every member's permissions rested on that single fallback line rather
-- than on the stored data. Had 'member' ever been added to ROLE_CAPABILITIES,
-- or the coercion refactored away, every existing member's privileges would
-- have changed at once with nothing in the diff to show it.
--
-- Behaviourally a no-op: 'member' already resolved to 'employee', so no one's
-- access changes. This just makes the database say what the app already meant.
--
-- The invite route now also writes role explicitly (belt and braces), and
-- tests/office-roles.test.ts pins BOTH halves: that the route names the role,
-- and that the unknown-role -> 'employee' fallback survives as a safety net for
-- rows arriving from a restored backup or an external insert.

alter table public.office_members alter column role set default 'employee';

update public.office_members set role = 'employee' where role = 'member';
