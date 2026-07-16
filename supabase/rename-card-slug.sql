-- Atomic card-URL (slug) rename. Moves the card AND every row keyed by its
-- slug — views, SwiftLink views, events, leads, analytics, per-card
-- notifications — to the new slug in ONE transaction, so a rename can never
-- half-apply and orphan a user's analytics/leads from their card. Ownership
-- and uniqueness are enforced INSIDE the function, so it's safe to call from
-- the service-role client.
--
-- Run ONCE in the Supabase SQL Editor. CREATE OR REPLACE — safe to re-run.
--
-- Returns jsonb: {ok:true, old, new} | {ok:true, unchanged:true}
--              | {ok:false, error:'not_found'|'taken'|'invalid'}
CREATE OR REPLACE FUNCTION rename_card_slug(
  p_card_id uuid,
  p_user_id uuid,
  p_new_slug text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_slug text;
BEGIN
  -- Charset guard — mirror the app's normalizeSlug output ([a-z0-9-], 1..60).
  IF p_new_slug IS NULL OR p_new_slug !~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  -- Ownership: the card must exist AND belong to this user. Locked FOR UPDATE
  -- so a concurrent rename of the same card serializes behind this one.
  SELECT username INTO v_old_slug
  FROM cards WHERE id = p_card_id AND user_id = p_user_id
  FOR UPDATE;
  IF v_old_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_old_slug = p_new_slug THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  -- Uniqueness: the public /card/<slug> route resolves against BOTH a card
  -- username and a legacy profile handle, so the new slug must be free in both.
  IF EXISTS (SELECT 1 FROM cards WHERE username = p_new_slug)
     OR EXISTS (SELECT 1 FROM profiles WHERE username = p_new_slug) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'taken');
  END IF;

  -- ── Migrate everything keyed by the slug (single transaction) ────────────
  UPDATE cards SET username = p_new_slug WHERE id = p_card_id;
  UPDATE card_views SET username = p_new_slug WHERE username = v_old_slug;
  -- SwiftLinks surface is tracked under "<slug>__links".
  UPDATE card_views SET username = p_new_slug || '__links' WHERE username = v_old_slug || '__links';
  UPDATE card_events SET card_owner_username = p_new_slug WHERE card_owner_username = v_old_slug;
  UPDATE leads SET card_owner = p_new_slug WHERE card_owner = v_old_slug;

  -- Optional tables/columns — guard so a not-yet-migrated schema can't abort
  -- the whole rename.
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    UPDATE analytics_events SET username = p_new_slug WHERE username = v_old_slug;
  END IF;
  BEGIN
    UPDATE notifications SET card_owner = p_new_slug WHERE card_owner = v_old_slug;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    NULL; -- notifications.card_owner not present yet — nothing to migrate
  END;

  RETURN jsonb_build_object('ok', true, 'old', v_old_slug, 'new', p_new_slug);
END;
$$;
