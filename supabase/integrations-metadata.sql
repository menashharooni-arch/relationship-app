-- integrations.metadata — per-provider connection detail that isn't a token.
--
-- APPLIED to production 2026-07-29 via Supabase apply_migration
-- (integrations_metadata_column). Kept here so the repo stays the source of
-- truth and a rebuilt environment matches.
--
-- Google and HubSpot need nothing beyond the token, which is why this column
-- didn't exist. The next two providers cannot work without it:
--
--   Pipedrive  api_domain  — v2 calls go to https://{company}.pipedrive.com,
--                            NOT a fixed host, so the domain has to be stored
--                            alongside the token or every request 404s.
--   HighLevel  locationId  — a Private Integration token is scoped to one
--                            sub-account, and the contacts payload must name it.
--
-- jsonb rather than typed columns: each provider needs a different key, and a
-- column per provider per field becomes a wide sparse table quickly.
--
-- NOTHING SECRET GOES HERE. Tokens stay in access_token, encrypted via
-- lib/token-crypto. metadata is non-sensitive connection routing only.

alter table public.integrations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.integrations.metadata is
  'Non-secret per-provider connection detail (Pipedrive api_domain, HighLevel locationId). Never store credentials here — access_token is the encrypted field.';
