-- Lock the server-managed columns on `profiles` against client writes.
--
-- APPLIED to production 2026-08-06 via Supabase MCP. Checked in so the posture
-- is reproducible rather than accidental.
--
-- The problem this closes: `profiles` carries an "Own update" RLS policy with
-- USING (auth.uid() = id), no column restriction and no WITH CHECK. It is
-- harmless TODAY only because the `authenticated` role holds zero UPDATE
-- privilege on the table — a fact that existed nowhere in this repo, so nothing
-- recorded it and nothing protected it.
--
-- That matters because the obvious one-line fix for "saving the Personal Note
-- returns 500" is `GRANT UPDATE ON profiles TO authenticated`, which would in
-- the same moment hand every signed-in user self-service PATCH over their own
-- plan, office_id and Stripe columns.
--
-- Two independent layers, so neither has to be remembered:
--   1. An explicit REVOKE — the posture stated rather than assumed.
--   2. A BEFORE UPDATE trigger that refuses privileged column changes from
--      client roles. This is the layer that still holds if someone adds the
--      GRANT later, and it depends on neither the grant nor the RLS policy.
--
-- SECURITY INVOKER is load-bearing. The first version of this was SECURITY
-- DEFINER, which makes `current_user` inside the function the function's OWNER
-- rather than the caller — so the role check passed unconditionally and the
-- guard never fired. It only needs to read NEW and OLD, so it needs no
-- elevated rights at all.
--
-- Verified against the live database: with UPDATE granted to `authenticated`
-- and a JWT whose sub matches the row (so RLS admits it), escalating `plan`
-- raises 42501 while editing an ordinary column still updates 1 row.
--
-- Rollback:
--   drop trigger if exists profiles_guard_privileged_columns on public.profiles;
--   drop function if exists public.profiles_guard_privileged_columns();

revoke update, insert on public.profiles from authenticated, anon;

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Only client roles are constrained. service_role (every server route in this
  -- app), postgres and the Supabase internal roles write freely — the Stripe
  -- webhook, the office cascades and the crons all run as service_role.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.plan                      is distinct from old.plan
     or new.office_id              is distinct from old.office_id
     or new.plan_expires_at        is distinct from old.plan_expires_at
     or new.stripe_customer_id     is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.referral_code          is distinct from old.referral_code
     or new.referred_by            is distinct from old.referred_by
  then
    raise exception
      'profiles: plan, office and billing columns are server-managed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();

comment on function public.profiles_guard_privileged_columns() is
  'Refuses client-role (authenticated/anon) UPDATEs that change plan/office/billing/referral columns. Independent of the RLS policy and of table grants, so it still holds if UPDATE is ever granted to authenticated.';
