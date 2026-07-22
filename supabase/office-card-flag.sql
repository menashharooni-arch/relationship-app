-- Office-card flag: scopes brand propagation to cards actually under the
-- office team, instead of every card the office owner/member happens to own.
-- SAFE & ADDITIVE: one column, defaulted to preserve today's behavior for the
-- common single-card case; never drops or rewrites unrelated data. Idempotent.
--
-- Run in the Supabase SQL editor.
-- Rollback:
--   alter table cards drop column if exists is_office_card;

-- Bug this fixes: with NO primary card and NO per-card office marker, brand
-- propagation (office-brand.ts) targeted every card a `user_id` owned. An
-- office owner (or member) who ALSO keeps a separate, unrelated card (e.g. the
-- "Personal"/"Nadlan Homes" cards alongside their office's "Malve Card") had
-- that unrelated card silently overwritten with the office's logo/company/
-- website every time the admin saved /office/admin/branding.
--
-- Going forward: only a card explicitly flagged is_office_card gets touched by
-- office brand propagation (src/lib/office-brand.ts, api/office/brand/route.ts).
-- New cards are flagged true only when they're the FIRST card on a brand-new
-- account under an office (drafts/claim/route.ts, count === 0) — i.e. the card
-- built right after accepting an office invite. Any additional card a member
-- creates afterward defaults to false (personal, untouched by office branding)
-- unless the member/owner explicitly opts it in.
alter table if exists public.cards
  add column if not exists is_office_card boolean not null default false;

-- Backfill: mark true only where there's no ambiguity — an office-linked
-- account with EXACTLY ONE existing card (the overwhelmingly common case,
-- where that one card unambiguously IS their team card). Accounts with
-- multiple cards (the exact ambiguous case this migration exists to fix) are
-- left false across the board — brand propagation simply stops touching them
-- until the owner/member explicitly marks one of their cards as office-managed.
update public.cards c
set is_office_card = true
where (
  exists (select 1 from public.profiles p where p.id = c.user_id and p.office_id is not null)
  or exists (select 1 from public.offices o where o.owner_id = c.user_id)
)
and (select count(*) from public.cards c2 where c2.user_id = c.user_id) = 1;

create index if not exists idx_cards_user_office_card on public.cards(user_id, is_office_card);
