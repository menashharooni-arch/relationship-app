-- Remove the primary-card concept (owner decision, Jul 2026).
-- The office brand now lives on offices.brand_* alone, written by the
-- /office/admin/branding page (seeded once from the owner's first card at
-- provision). Run AFTER the code that stops referencing primary_card_id is
-- deployed. brand_design and cards.is_offline are kept — still in use.
drop index if exists idx_offices_primary_card_id;
alter table offices drop column if exists primary_card_id;
