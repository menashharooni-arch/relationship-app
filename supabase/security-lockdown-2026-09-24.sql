-- Security lockdown, applied to production 2026-09-24 (migrations
-- security_lockdown_browser_writes_2026_09_24 and
-- revoke_rename_card_slug_from_clients). Kept here as the record.
--
-- The browser holds the public anon key and a user JWT, so anything granted to
-- anon/authenticated is callable directly through PostgREST / Storage.

-- Every write to offices / office_members goes through the server (service
-- role). The browser write grants let a signed-in user create their own
-- office, give it free seats, and attach ANY user as an "active member".
revoke insert, update, delete, truncate on public.offices from anon, authenticated;
revoke insert, update, delete, truncate on public.office_members from anon, authenticated;

-- TRUNCATE ignores RLS. PostgREST doesn't expose it; no client role needs it.
revoke truncate on all tables in schema public from anon, authenticated;

-- SECURITY DEFINER maintenance functions were callable anonymously.
revoke execute on function public.prune_error_events() from public, anon, authenticated;
revoke execute on function public.prune_product_events() from public, anon, authenticated;
grant execute on function public.prune_error_events() to service_role;
grant execute on function public.prune_product_events() to service_role;

-- rename_card_slug trusts its p_user_id argument; only the server calls it.
revoke execute on function public.rename_card_slug(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rename_card_slug(uuid, uuid, text) to service_role;

-- Storage: every upload goes through the server (admin client, or a signed
-- upload URL whose path the server builds). These policies only let a
-- signed-in user put ANY file of ANY size into the PUBLIC card-uploads bucket.
drop policy if exists "Users can update own files" on storage.objects;
drop policy if exists "Users can upload own files" on storage.objects;

-- Bucket limits are enforced even for signed upload URLs (whose size the
-- client only DECLARES to /api/upload/link-video).
update storage.buckets
   set file_size_limit = 27262976,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
 where id = 'card-uploads';
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/png']
 where id in ('card-shares','card-signatures');
