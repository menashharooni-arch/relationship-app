-- Lock client-side reads of lead / view / notification rows (2026-09-23).
--
-- WHY. Free accounts see a contact's or viewer's location blanked ("▒▒▒▒▒")
-- and over-limit leads locked. Both are decided on the SERVER at read time
-- (lib/notification-privacy, contacts/page, the sc-locked lead tag). But these
-- policies let a signed-in user query the tables directly with their own
-- session — which any page script holds — so a Free account could read the
-- real place names in devtools:
--     supabase.from('notifications').select('body')
--     supabase.from('leads').select('location')
--     supabase.from('card_views').select('location')
-- and "Own leads update" let it strip the sc-locked tag and unlock leads it
-- had not paid for.
--
-- NOTHING IN THE APP USES THESE POLICIES. Every read and write of these tables
-- goes through the service-role client, scoped to the caller's own user_id /
-- card slugs in code; the last session-client reads (api/notifications and the
-- dashboard's bell) moved to the service role in the same change. No browser
-- code reads these tables and no realtime channel subscribes to them. RLS stays
-- ENABLED, so with no policy the anon and authenticated roles can do nothing
-- here, and the service role (which bypasses RLS) is unaffected.
--
-- Deploy the code first, then run this.

drop policy if exists "Users see own notifications" on public.notifications;
drop policy if exists "Users read own views" on public.card_views;
drop policy if exists "Own leads read" on public.leads;
drop policy if exists "Own leads update" on public.leads;
