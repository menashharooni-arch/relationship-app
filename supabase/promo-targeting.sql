-- Promo codes: which plan, which billing period, and how long money off lasts.
--
-- Until this ran, a code could only be "N days free for accounts not paying
-- yet" — the admin form had no way to say whether an offer was for Pro or for
-- Office (owner, 2026-09-17). Every column is nullable with a default, and the
-- app treats a missing column as the default, so running this is safe at any
-- time and the app works before and after.
--
-- Run in Supabase → SQL Editor.

alter table public.promo_codes
  -- Which PLAN the discount is for: 'any' | 'pro' | 'office'.
  add column if not exists applies_to text not null default 'any',
  -- Which billing period: 'any' | 'monthly' | 'annual'.
  add column if not exists interval_target text not null default 'any',
  -- Money-off duration, mirroring Stripe's coupon duration:
  -- 'once' (first payment) | 'repeating' (duration_months) | 'forever'.
  add column if not exists duration text not null default 'once',
  add column if not exists duration_months integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promo_codes_applies_to_check') then
    alter table public.promo_codes
      add constraint promo_codes_applies_to_check check (applies_to in ('any', 'pro', 'office'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'promo_codes_interval_target_check') then
    alter table public.promo_codes
      add constraint promo_codes_interval_target_check check (interval_target in ('any', 'monthly', 'annual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'promo_codes_duration_check') then
    alter table public.promo_codes
      add constraint promo_codes_duration_check check (duration in ('once', 'repeating', 'forever'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'promo_codes_duration_months_check') then
    alter table public.promo_codes
      add constraint promo_codes_duration_months_check
      check (duration <> 'repeating' or (duration_months between 1 and 36));
  end if;
end $$;
