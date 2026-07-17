-- Invite-only signups (2026-07-17). APPLIED to production.
--
-- A brand-new account is provisioned at /onboarding ONLY if it presents a valid
-- code from signup_invites OR the email has a pending office-team invite
-- (office_members.status = 'pending'). Enforcement lives in
-- src/app/onboarding/page.tsx (authoritative, covers email + Google + Apple),
-- with a pre-check in /api/invite/verify + src/components/LoginForm.tsx.
--
-- Both tables are accessed only through the service-role client
-- (src/lib/signup-invite.ts), so RLS is enabled with NO policies to block any
-- direct anon/authenticated PostgREST access to the code list.

create table if not exists public.signup_invites (
  code text primary key,
  label text,
  max_uses integer not null default 1,
  uses integer not null default 0,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.signup_invites enable row level security;

create table if not exists public.signup_invite_uses (
  user_id uuid primary key,
  code text not null,
  used_at timestamptz not null default now()
);
alter table public.signup_invite_uses enable row level security;

-- Initial shareable launch code (seeded once). Manage codes with plain SQL:
--   New code:     insert into signup_invites (code, label, max_uses)
--                   values ('FRIENDS-2026', 'personal invites', 25);
--   Revoke:       update signup_invites set disabled = true where code = 'X';
--   Raise limit:  update signup_invites set max_uses = 1000 where code = 'X';
--   See usage:    select code, uses, max_uses, disabled from signup_invites;
insert into public.signup_invites (code, label, max_uses)
values ('SWIFTCARD-VIP', 'initial launch invite (shareable)', 500)
on conflict (code) do nothing;