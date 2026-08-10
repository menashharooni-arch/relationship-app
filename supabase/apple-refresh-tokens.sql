-- Applied to production 2026-08-10 via the Supabase management API.
--
-- Stores the Apple provider refresh token captured at sign-in, so account
-- deletion can revoke it at appleid.apple.com/auth/revoke (App Review
-- 5.1.1(v)). Supabase surfaces this token exactly once, on the session right
-- after the code exchange — identity_data never contains it, which is why
-- revocation silently did nothing before this table existed.
--
-- Service-role only: RLS enabled with NO policies, and table grants revoked
-- from anon/authenticated. Row disappears with the user (ON DELETE CASCADE).
create table if not exists public.apple_refresh_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_refresh_tokens enable row level security;
revoke all on public.apple_refresh_tokens from anon, authenticated;
