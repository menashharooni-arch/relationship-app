-- Company-controlled uniform fields + branding locks (spec §8/§9).
-- SAFE & ADDITIVE: only adds columns with defaults; never drops/rewrites data,
-- so it cannot break existing offices, cards, or members. Idempotent.
--
-- Run in the Supabase SQL editor.
-- Rollback:
--   alter table offices drop column if exists brand_phone;
--   alter table offices drop column if exists brand_fax;
--   alter table offices drop column if exists brand_address;
--   alter table offices drop column if exists brand_locks;

-- Company-controlled contact fields, uniform across every member card and not
-- editable by employees. brand_address holds {street,unit,city,state,zip}.
alter table if exists public.offices add column if not exists brand_phone text;
alter table if exists public.offices add column if not exists brand_fax text;
alter table if exists public.offices add column if not exists brand_address jsonb;

-- Per-field branding locks. Today it governs the TEMPLATE default: locked (the
-- historical behavior) forces the office template on member cards; unlocked lets
-- employees choose their own template. Defaults to locked so existing offices'
-- uniform look is preserved. Shape: {"template": true}.
alter table if exists public.offices
  add column if not exists brand_locks jsonb not null default '{"template": true}'::jsonb;
