-- ════════════════════════════════════════════════════════════════════════════
-- SwiftCard referral system — run this ONCE in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Columns on profiles ------------------------------------------------------
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists signup_source text;
alter table public.profiles add column if not exists plan_expires_at timestamptz;     -- when a free-month grant ends (NULL = no expiry / paid)
alter table public.profiles add column if not exists referral_reward_earned boolean not null default false;
alter table public.profiles add column if not exists signup_ip text;

create unique index if not exists profiles_referral_code_key on public.profiles (referral_code) where referral_code is not null;
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);
create index if not exists profiles_signup_source_idx on public.profiles (signup_source);
create index if not exists profiles_plan_expires_idx on public.profiles (plan_expires_at) where plan_expires_at is not null;

-- 2) referrals table — one row per referred signup ----------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id  uuid references public.profiles(id) on delete set null,  -- who shared the link
  referred_id  uuid references public.profiles(id) on delete cascade,   -- the new user
  code         text,                                                    -- referral code used
  status       text not null default 'signed_up',  -- signed_up | paid | rewarded | self_referral | flagged
  reward_granted boolean not null default false,    -- did the REFERRER get their reward for this one
  signup_ip    text,
  flagged_reason text,
  created_at   timestamptz not null default now(),
  paid_at      timestamptz,
  rewarded_at  timestamptz
);

create unique index if not exists referrals_referred_id_key on public.referrals (referred_id);
create index if not exists referrals_referrer_id_idx on public.referrals (referrer_id);
create index if not exists referrals_status_idx on public.referrals (status);

-- 2b) Fraud-signal columns: device fingerprint (signup) + card fingerprint (Stripe)
alter table public.profiles  add column if not exists signup_device text;
alter table public.profiles  add column if not exists payment_fingerprint text;
alter table public.referrals add column if not exists signup_device text;
create index if not exists profiles_payment_fingerprint_idx on public.profiles (payment_fingerprint) where payment_fingerprint is not null;
create index if not exists profiles_signup_device_idx on public.profiles (signup_device) where signup_device is not null;

-- 3) Backfill: give every EXISTING user a referral code -----------------------
-- 8 hex chars from gen_random_uuid() (core Postgres 13+ — no pgcrypto needed, so
-- this can't abort on a project where pgcrypto isn't enabled). Fills NULLs only.
update public.profiles p
set referral_code = upper(left(replace(gen_random_uuid()::text, '-', ''), 8))
where p.referral_code is null;

-- (If any duplicate codes slipped in on backfill, re-run this until 0 rows:)
-- with d as (select id, row_number() over (partition by referral_code order by created_at) rn from public.profiles where referral_code is not null)
-- update public.profiles p set referral_code = null from d where p.id = d.id and d.rn > 1;
-- then re-run step 3.

-- RLS: referrals is written only by the service role (backend). No client policy
-- needed — service role bypasses RLS. Owners read their referral status through
-- server components, also via the service role.
