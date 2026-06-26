-- Office (Team) uniform branding — run once in the Supabase SQL editor.
-- Lets an Office admin set a logo (mandatory), company, website, and a uniform
-- card design that applies to every card under the office (admin + all seats).
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_logo_url     text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_company      text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_website      text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_template     text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS brand_custom_layout jsonb;
