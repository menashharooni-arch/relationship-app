-- ── Demo accounts for the /preview page ──────────────────────────────────────
--
-- The marketing "See It Live" preview embeds the REAL /card and /links routes
-- for two demo accounts (demo-sales, demo-realty). Those routes read real rows,
-- so these accounts must exist in production — they vanished at some point
-- (profiles.id cascades from auth.users, so deleting the auth users took
-- everything with them) and the preview iframed 404s for weeks.
--
-- Idempotent: fixed UUIDs + ON CONFLICT, safe to re-run any time.
-- The auth users get a random bcrypt password nobody knows and can never be
-- logged into; they exist only to satisfy the FK chain.
-- plan='pro' so the public pages render the full product with no Free badge —
-- no plan_expires_at and no Stripe fields, so the expiry cron ignores them.

-- 1. Auth users (FK root)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('d0000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo-sales@swiftcard.me',
   extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('d0000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo-realty@swiftcard.me',
   extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

-- 2. Profiles
INSERT INTO public.profiles (id, username, name, email, plan, customization)
VALUES
  ('d0000000-0000-4000-a000-000000000001', 'demo-sales', 'Alex Morgan', 'demo-sales@swiftcard.me', 'pro', '{}'::jsonb),
  ('d0000000-0000-4000-a000-000000000002', 'demo-realty', 'Alex Morgan', 'demo-realty@swiftcard.me', 'pro', '{}'::jsonb)
ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username, name = EXCLUDED.name, plan = EXCLUDED.plan;

-- 3. Cards — content mirrors src/app/preview/PreviewClient.tsx's CARDS data
--    exactly, so the simulated dashboard and the real embedded pages agree.
INSERT INTO public.cards (
  user_id, username, label, name, title, company, phone, email, website,
  linkedin, instagram, twitter, tiktok, template, customization, is_office_card
)
VALUES
  ('d0000000-0000-4000-a000-000000000001', 'demo-sales', 'Sales Card',
   'Alex Morgan', 'Account Executive', 'Northwind SaaS',
   '(415) 555-0142', 'alex@northwind.io', 'northwind.io',
   'https://www.linkedin.com/company/swiftcard', 'https://www.instagram.com/swiftcard.me', '', '',
   'modern-bold',
   '{"accentColor":"#2563eb",
     "bio":"Helping teams close faster with Northwind. Grab time below or reach me anywhere.",
     "links":[
       {"emoji":"","label":"Book a demo","url":"https://calendly.com"},
       {"emoji":"","label":"Why teams pick Northwind","url":"https://swiftcard.me/products/lead-capture"},
       {"emoji":"","label":"Connect on LinkedIn","url":"https://www.linkedin.com/company/swiftcard"}
     ]}'::jsonb,
   false),
  ('d0000000-0000-4000-a000-000000000002', 'demo-realty', 'Real Estate Card',
   'Alex Morgan', 'Realtor®', 'Coastline Realty',
   '(415) 555-0188', 'alex@coastlinerealty.com', 'coastlinehomes.com',
   'https://www.linkedin.com/company/swiftcard', 'https://www.instagram.com/swiftcard.me', '', '',
   'local-business',
   '{"accentColor":"#d97706",
     "bio":"Bay Area homes, from first tour to closing day. Let''s find yours.",
     "address":"1200 Ocean Ave\nSan Francisco\nCA 94122",
     "links":[
       {"emoji":"","label":"Book a viewing","url":"https://calendly.com"},
       {"emoji":"","label":"Current listings","url":"https://www.zillow.com"},
       {"emoji":"","label":"Connect on LinkedIn","url":"https://www.linkedin.com/company/swiftcard"}
     ]}'::jsonb,
   false)
ON CONFLICT (username) DO UPDATE SET
  label = EXCLUDED.label, name = EXCLUDED.name, title = EXCLUDED.title,
  company = EXCLUDED.company, phone = EXCLUDED.phone, email = EXCLUDED.email,
  website = EXCLUDED.website, linkedin = EXCLUDED.linkedin,
  instagram = EXCLUDED.instagram, template = EXCLUDED.template,
  customization = EXCLUDED.customization;
