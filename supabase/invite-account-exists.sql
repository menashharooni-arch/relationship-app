-- ── Does the INVITED address already have a SwiftCard account? ──────────────
-- (owner, 2026-09-24): an invite goes to one specific address, so the invite
-- page offers ONE way in — "Create my account" with that address — not a
-- choice between creating and signing in. The one exception is an address
-- that already has an account (a Free user whose company later buys Office):
-- creating it again fails, so for that address the one button signs in.
--
-- Asked only by the /join page and /login, server-side, about the address
-- stored on the invite row — never about an address a visitor typed. Service
-- role only: anon and signed-in callers cannot use it to test addresses.
create or replace function public.auth_email_registered(p_email text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where email = lower(trim(p_email)));
$$;

revoke all on function public.auth_email_registered(text) from public, anon, authenticated;
grant execute on function public.auth_email_registered(text) to service_role;
