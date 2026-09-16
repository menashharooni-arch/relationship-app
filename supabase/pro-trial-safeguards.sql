-- Pro trial safeguards (2026-09-16).
--
-- APPLIED to production 2026-09-16 (Supabase MCP apply_migration
-- "pro_trial_safeguards"; verified: columns readable, anon denied on the ledger,
-- guard trigger lists both new columns). The code degrades if they are missing (42703 /
-- PGRST204 / 42P01): the abuse checks are skipped and today's behaviour
-- continues — it never blocks a checkout or a signup.
--
-- The Pro trial is opt-in and card-required (Stripe trial_period_days / the
-- Apple intro offer). These objects make it ONE PER PERSON and make the end of
-- Pro an intentional choice:
--
--   profiles.pro_trial_started_at — "this account has used a Pro trial".
--     Stamped by the Stripe webhook / RevenueCat when a subscription starts in
--     trial. Nothing clears it: not a downgrade, not the cron, not an admin
--     plan change (unlike customization._trial*, which all three delete).
--
--   profiles.free_live_card_id — the card the person chose to keep live when
--     Pro ended. NULL = today's rule (the oldest card stays live).
--
--   trial_ledger — survives account purge (lib/account-purge.ts must NEVER
--     touch it). One-way hashes only:
--       kind 'card'            sha256 of a Stripe card fingerprint that got a trial
--       kind 'email_trial'     sha256 of a normalised email that got a trial
--       kind 'email_retention' sha256 of a normalised email that took the
--                              delete-flow free days
--     Without it, deleting an account and waiting out the 30-day purge frees
--     the email for a second trial and a second retention grant.
--
-- Rollback:
--   alter table public.profiles drop column if exists pro_trial_started_at;
--   alter table public.profiles drop column if exists free_live_card_id;
--   drop table if exists public.trial_ledger;
--   (then re-run profiles-privileged-column-guard.sql to restore the old trigger)

alter table public.profiles add column if not exists pro_trial_started_at timestamptz;
alter table public.profiles add column if not exists free_live_card_id uuid references public.cards(id) on delete set null;

create table if not exists public.trial_ledger (
  kind       text not null check (kind in ('card', 'email_trial', 'email_retention')),
  key_hash   text not null,
  created_at timestamptz not null default now(),
  primary key (kind, key_hash)
);

-- Service role only: RLS on with no policies, and no grants to client roles.
alter table public.trial_ledger enable row level security;
revoke all on public.trial_ledger from anon, authenticated;

-- Same guard as profiles-privileged-column-guard.sql, with the two new
-- server-managed columns added. SECURITY INVOKER is load-bearing (see that file).
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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
     or new.pro_trial_started_at   is distinct from old.pro_trial_started_at
     or new.free_live_card_id      is distinct from old.free_live_card_id
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
