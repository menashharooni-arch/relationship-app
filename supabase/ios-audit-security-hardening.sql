-- iOS App Store audit — security hardening (2026-07-17). APPLIED to production.
--
-- 1) Enable RLS on the three PostgREST-exposed tables that had it disabled
--    (Supabase linter 0013, ERROR level). All reads/writes to these tables go
--    through the service-role client (src/app/api/{push/subscribe,card-events,
--    analytics/event}, src/lib/{push,apns,office-analytics,account-purge}),
--    which bypasses RLS — so this blocks direct anon/authenticated access
--    without changing app behavior. No policies are added on purpose: there is
--    no legitimate client-side access.
alter table public.push_subscriptions enable row level security;
alter table public.card_events enable row level security;
alter table public.analytics_events enable row level security;

-- 2) Pin search_path on flagged functions (linter 0011). Pinned to `public`
--    (not '') because the function bodies use unqualified table names.
alter function public.card_view_utc_day(ts timestamptz) set search_path = public;
alter function public.office_daily_views(p_keys text[], p_since timestamptz, p_until timestamptz) set search_path = public;
alter function public.office_employee_contact_stats(p_usernames text[], p_since timestamptz, p_until timestamptz) set search_path = public;
alter function public.office_employee_lead_stats(p_usernames text[], p_since timestamptz, p_until timestamptz) set search_path = public;
alter function public.office_employee_view_stats(p_keys text[], p_since timestamptz, p_until timestamptz) set search_path = public;
alter function public.office_traffic_sources(p_keys text[], p_since timestamptz, p_until timestamptz) set search_path = public;
alter function public.rename_card_slug(p_card_id uuid, p_user_id uuid, p_new_slug text) set search_path = public;

-- 3) card-uploads is a PUBLIC bucket: objects are served via the public URL
--    path, which does not consult storage.objects policies. The broad SELECT
--    policy only enabled client-side listing of every file (linter 0025).
drop policy if exists "Public read card-uploads" on storage.objects;

-- NOT done here (Supabase dashboard toggles, no SQL equivalent):
--   * Auth > leaked-password protection (HaveIBeenPwned check) — enable it.
