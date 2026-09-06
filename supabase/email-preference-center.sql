-- ── Email preference centre ─────────────────────────────────────────────────
--
-- Run this in the Supabase SQL editor. Safe to re-run.
--
-- email_preferences ALREADY EXISTS and is load-bearing: `receipt_emails` gates
-- Stripe receipts (api/stripe/webhook), `unsubscribe_token` is what the RFC 8058
-- one-click URL resolves, and `marketing_emails` is what every current send path
-- checks. None of those are dropped or renamed here — this only ADDS the
-- category columns the preference centre needs.
--
-- TWO FLAGS, ONE TRUTH. `marketing_opt_out` is the new authoritative switch and
-- `marketing_emails` is the legacy one. Older senders read only the legacy
-- column, so canSendMarketing() treats EITHER as a suppression and every write
-- path sets BOTH. Do not "simplify" that to one column until no code reads
-- marketing_emails — an opt-out that only lands in one of them is an opt-out we
-- fail to honour, which is a CAN-SPAM violation and a Gmail complaint.

alter table public.email_preferences add column if not exists lead_tips boolean not null default true;
alter table public.email_preferences add column if not exists product_updates boolean not null default true;
alter table public.email_preferences add column if not exists digest boolean not null default true;
alter table public.email_preferences add column if not exists digest_frequency text not null default 'weekly';
alter table public.email_preferences add column if not exists promotions boolean not null default true;
alter table public.email_preferences add column if not exists paused_until timestamptz;
alter table public.email_preferences add column if not exists marketing_opt_out boolean not null default false;
alter table public.email_preferences add column if not exists updated_at timestamptz not null default now();

-- Enum-by-constraint. Added NOT VALID then validated so an existing row with a
-- junk value surfaces as a migration error you can see, rather than silently
-- blocking every future write.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_preferences_digest_frequency_check'
  ) then
    alter table public.email_preferences
      add constraint email_preferences_digest_frequency_check
      check (digest_frequency in ('weekly', 'monthly')) not valid;
    alter table public.email_preferences validate constraint email_preferences_digest_frequency_check;
  end if;
end $$;

-- Existing rows predate the columns; backfill the legacy flag into the new one
-- so anyone who already unsubscribed stays unsubscribed under the new check.
update public.email_preferences
   set marketing_opt_out = true
 where marketing_emails = false
   and marketing_opt_out = false;

-- ── unsubscribe_events ──────────────────────────────────────────────────────
-- Why every opt-out is logged: CAN-SPAM requires honouring a request within 10
-- business days and the burden of proof is ours. This table is that proof, and
-- it is also the only way to tell a footer opt-out from a Gmail one-click one.
create table if not exists public.unsubscribe_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  source text not null check (source in ('footer', 'one_click_header')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists unsubscribe_events_user_idx on public.unsubscribe_events (user_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- A signed-in user reads and updates ONLY their own row. The token-based routes
-- do not rely on this: they run server-side with the service-role key, which
-- bypasses RLS by design, because the whole point of the preference centre is
-- that it works with no login.
alter table public.email_preferences enable row level security;
alter table public.unsubscribe_events enable row level security;

drop policy if exists "own email preferences: read" on public.email_preferences;
create policy "own email preferences: read"
  on public.email_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "own email preferences: update" on public.email_preferences;
create policy "own email preferences: update"
  on public.email_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own email preferences: insert" on public.email_preferences;
create policy "own email preferences: insert"
  on public.email_preferences for insert
  with check (auth.uid() = user_id);

-- Opt-out history is written server-side only. A user may read their own;
-- nobody may edit or delete one, because a deletable audit trail is not proof.
drop policy if exists "own unsubscribe events: read" on public.unsubscribe_events;
create policy "own unsubscribe events: read"
  on public.unsubscribe_events for select
  using (auth.uid() = user_id);
