-- Office primary card + design lock + card offline switch.
-- SAFE & ADDITIVE: only adds columns (two nullable, one with a default that
-- matches today's behavior); never drops or rewrites data. Idempotent.
--
-- Run in the Supabase SQL editor.
-- Rollback:
--   alter table offices drop column if exists primary_card_id;
--   alter table offices drop column if exists brand_design;
--   alter table cards   drop column if exists is_offline;

-- The admin's original card. Every employee card is based on it: it is the
-- source of the office's logo/company/website/template/design, and it is shown
-- as "Primary" in the UI. Nullable — an office exists before its first card.
-- ON DELETE SET NULL: deleting the card must never take the office row with it.
alter table if exists public.offices
  add column if not exists primary_card_id uuid references public.cards(id) on delete set null;

-- The locked look, copied from the primary card's customization: accentColor,
-- font, bgColor, textColor, infoColor, fontFamily. Kept separate from
-- brand_custom_layout (which is only for the "custom" template's layout JSON).
-- Employees never own these while the template lock is on — they own only their
-- personal content (name/title/email/phone/headshot/bio/personal links).
alter table if exists public.offices
  add column if not exists brand_design jsonb;

-- Admin "take offline": hides the public /card/<slug> without deleting anything.
-- The card, its scan history and its captured contacts all survive, so the
-- action is reversible (used when someone leaves, or a card needs pulling).
-- Defaults false = every existing card stays live, so this is a no-op until used.
alter table if exists public.cards
  add column if not exists is_offline boolean not null default false;

-- Fast lookup for the office admin's card list.
create index if not exists idx_offices_primary_card_id on public.offices(primary_card_id);
