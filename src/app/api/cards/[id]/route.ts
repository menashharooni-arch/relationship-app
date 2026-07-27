import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";
import { getMemberBrandForUser, overlayOfficeContact, overlayOfficeDesign, findManagedFieldViolations } from "@/lib/office-brand";
import { normalizeSocial } from "@/lib/social-url";
import { getOfficeSubUserContext } from "@/lib/office-roles";

const ALLOWED = ["name", "title", "company", "phone", "email", "website", "linkedin", "instagram", "twitter", "tiktok", "template", "customization", "logo_url", "label"];
const SOCIAL_COLUMNS = ["linkedin", "instagram", "twitter", "tiktok"] as const;

// Scalar fields that are printed ON the card (and therefore baked into the Swift
// Signature snapshot). "label" is deliberately excluded — it's the dashboard
// nickname, never shown on the card. `template` + `customization` (design/photo/
// bio/layout) are compared separately below.
const ON_CARD_SCALARS = ["name", "title", "company", "phone", "email", "website", "linkedin", "instagram", "twitter", "tiktok", "template", "logo_url"] as const;

// Stable, key-order-independent JSON so a no-op customization save (Postgres jsonb
// re-orders keys) isn't mistaken for a real design change.
function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>).sort().reduce<Record<string, unknown>>((o, k) => {
      o[k] = canonicalize((v as Record<string, unknown>)[k]);
      return o;
    }, {});
  }
  return v;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key];
  }
  // Server-side normalize (backstop for older/other clients): stored social
  // values must always build a working profile URL. See lib/social-url.ts.
  for (const key of SOCIAL_COLUMNS) {
    if (key in updates) updates[key] = normalizeSocial(String(updates[key] ?? ""), key);
  }

  const admin = getAdminSupabase();

  // Snapshot the card's on-card fields BEFORE the write, so after saving we can
  // tell whether anything the Swift Signature SHOWS actually changed and, if so,
  // nudge the owner to re-copy their email signature (it's a snapshot image, so
  // an edit leaves the pasted signature stale). A no-op save must never nag.
  const { data: beforeCard } = await admin
    .from("cards")
    .select("username, name, title, company, phone, email, website, linkedin, instagram, twitter, tiktok, template, logo_url, customization")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Enforce Pro-only features on the backend: custom template, Pro-only design
  // keys (accent/font), and the link-button cap — all stripped for non-paid.
  const { data: planRow } = await admin.from("profiles").select("plan, customization").eq("id", user.id).single();

  // A soft-deleted account's access token stays valid for its remaining
  // lifetime (signOut only revokes the refresh token) — block writes here too.
  if ((planRow?.customization as Record<string, unknown> | null)?._deleted === true) {
    return NextResponse.json({ error: "This account has been deleted." }, { status: 403 });
  }

  if (!isPaidPlan(planRow?.plan)) {
    // Grandfathering: a downgraded user keeps every card, but only the first
    // FREE_CARD_LIMIT stay editable — extras are view-only (still live publicly).
    const { data: owned } = await admin
      .from("cards")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if ((owned?.length ?? 0) > PLAN_LIMITS.FREE_CARD_LIMIT) {
      const editable = (owned ?? []).slice(0, PLAN_LIMITS.FREE_CARD_LIMIT).map((c) => c.id);
      if (!editable.includes(id)) {
        return NextResponse.json(
          { code: "CARD_VIEW_ONLY", error: "view_only", message: "This card is view-only on Free. Upgrade to Pro to edit all your cards.", upgrade: "/pricing" },
          { status: 403 }
        );
      }
    }
    if (updates.template === "custom") updates.template = "classic-pro";
  }

  // Resolved once, used by the merge below AND the branding section: is the
  // caller an office SUB-USER (active member, not the owner)?
  const subCtx = await getOfficeSubUserContext(user.id);

  // Merge the incoming customization onto THIS card's existing customization
  // (same card, ownership-scoped) rather than replacing the whole JSON. The form
  // only sends the keys it manages, so without this a key it doesn't send (e.g.
  // testimonials, or any future field) would be silently wiped on save. Merging
  // the card's OWN data can never introduce cross-card bleed — form keys win,
  // omitted keys are preserved. Free plans still have Pro-only keys stripped.
  if ("customization" in updates) {
    const { data: existingCard } = await admin
      .from("cards")
      .select("customization, template")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    // Server-owned "_"-prefixed keys never come from the client — strip any the
    // payload tries to send so a crafted request can't overwrite internal flags.
    const incoming = { ...(updates.customization as Record<string, unknown>) };
    for (const k of Object.keys(incoming)) if (k.startsWith("_")) delete incoming[k];
    // Company fax/address are org territory for a sub-user (even on an office
    // with no brand set yet — the UI never shows a member those inputs, so a
    // crafted value must not land either). Dropping them from `incoming` means
    // the merge below keeps the card's existing values; when a brand exists,
    // the overlay further down re-applies the org's own.
    if (subCtx) {
      delete incoming.fax;
      delete incoming.address;
    }
    const merged = {
      ...((existingCard?.customization as Record<string, unknown> | null) ?? {}),
      ...incoming,
    };
    const effectiveTemplate = (updates.template as string | undefined) ?? (existingCard?.template as string | undefined);
    updates.customization = isPaidPlan(planRow?.plan) ? merged : sanitizeCustomizationForPlan(merged, false, effectiveTemplate);
  }

  // Office uniform branding: force company-controlled fields so members can't
  // override them (spec §8). Template + the look are forced only when locked
  // (§9) — an unlocked office lets employees choose their own. This applies to
  // EVERY card under the office, the owner's included — the brand is edited on
  // /office/admin/branding, not by exempting any particular card.
  const brand = await getMemberBrandForUser(user.id);
  // Company-level fields are org territory for a SUB-USER even when the office
  // has no brand set yet (the UI never shows those inputs to a member): a
  // crafted request must not write them either. Dropped from the update here
  // (fax/address were already dropped in the customization merge above); when
  // a brand exists, its own values are re-applied just below.
  if (subCtx) {
    delete updates.company;
    delete updates.website;
    delete updates.logo_url;
    delete updates.label;
  }
  if (brand) {
    // A SUB-USER (active member, not the owner) explicitly trying to CHANGE an
    // org-managed field is refused outright — even a hand-crafted request never
    // silently rewrites company data. Values that match the brand pass through
    // (the editor sends the whole card back), and the overlays below stay as
    // the normalization backstop.
    if (subCtx) {
      // Compare against the card's CURRENT stored values too, so echoing a
      // value the card already holds (managed data that lagged the brand) is
      // never rejected — only an actual off-brand change is. Prevents a
      // permanent save-lockout when brand propagation lagged.
      const { data: currentCard } = await admin
        .from("cards")
        .select("company, website, logo_url, template, customization")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      const violations = findManagedFieldViolations(body, brand, {
        company: currentCard?.company,
        website: currentCard?.website,
        logo_url: currentCard?.logo_url,
        template: currentCard?.template,
        customization: (currentCard?.customization as Record<string, unknown> | null) ?? null,
      });
      if (violations.length) {
        return NextResponse.json(
          {
            error: "managed_by_org",
            message: `The ${violations.join(", ")} on this card ${violations.length > 1 ? "are" : "is"} managed by your organization. Refresh the page to see the latest company details.`,
          },
          { status: 403 }
        );
      }
    }
    if (brand.logoUrl) updates.logo_url = brand.logoUrl;
    if (brand.company) updates.company = brand.company;
    // Nickname is company-controlled on connected cards (sourced from the
    // company name), so member dashboards all show the same label.
    if (brand.company && subCtx) updates.label = brand.company;
    if (brand.website) updates.website = brand.website;
    if (brand.lockTemplate && brand.template) updates.template = brand.template;
    // Company phone/fax/address + the locked look are enforced whenever the
    // client sends customization (the overlays re-apply on top of the edit).
    if ("customization" in updates) {
      if (brand.phone || brand.fax || brand.address) {
        updates.customization = overlayOfficeContact(updates.customization as Record<string, unknown>, brand);
      }
      updates.customization = overlayOfficeDesign(updates.customization as Record<string, unknown>, brand);
      if (brand.lockTemplate && brand.template === "custom" && brand.customLayout) {
        updates.customization = { ...(updates.customization as Record<string, unknown>), customLayout: brand.customLayout };
      }
    }
  }

  const { error } = await admin
    .from("cards")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Swift Signature freshness nudge: if anything shown ON the card actually
  // changed (a scalar on-card field, the template, or the design/customization
  // JSON), drop a bell + quick-contact notification telling the owner to re-copy
  // their email signature. Compared against the pre-write snapshot so opening the
  // editor and saving unchanged never notifies; deduped to one unread reminder
  // per card so a burst of edits doesn't spam. Best-effort — never fails a save.
  try {
    if (beforeCard) {
      const b = beforeCard as Record<string, unknown>;
      let cardChanged = false;
      for (const k of ON_CARD_SCALARS) {
        if (k in updates && String((updates as Record<string, unknown>)[k] ?? "") !== String(b[k] ?? "")) {
          cardChanged = true;
          break;
        }
      }
      if (!cardChanged && "customization" in updates) {
        cardChanged =
          JSON.stringify(canonicalize(updates.customization ?? {})) !==
          JSON.stringify(canonicalize(b.customization ?? {}));
      }
      if (cardChanged) {
        const username = b.username as string;

        // SHARE-PREVIEW freshness: the stored pixel-perfect capture
        // (card-shares/<username>.png) is now stale. Delete it so the card's
        // link preview immediately falls back to the LIVE-rendered Tier-2 image
        // (built from the current card data) instead of serving the OLD card,
        // until the client re-captures an exact copy on the next dashboard/editor
        // render. The versioned og:image URL busts the messenger cache in step.
        // Best-effort — never blocks the save.
        admin.storage.from("card-shares").remove([`${username}.png`]).then(() => {}, () => {});

        // One pending (unread) reminder per card is enough — skip if one exists.
        const { data: pending } = await admin
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "signature_stale")
          .eq("card_owner", username)
          .eq("read", false)
          .limit(1);
        if (!pending?.length) {
          const { insertNotification } = await import("@/lib/notify");
          await insertNotification({
            user_id: user.id,
            card_owner: username,
            type: "signature_stale",
            title: "Update your email signature",
            body: "You changed your card — re-copy your Swift Signature so the version in your email matches.",
          });
        }
      }
    }
  } catch {
    /* notification is a nicety; a card save must still succeed */
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  // Look the card up first: everything keyed to it (leads, views, events,
  // notifications) is keyed by USERNAME. Deleting the row frees the username —
  // without this cleanup, whoever registers the same slug next would inherit
  // this card's leads and visitor history (a cross-account data leak). The
  // owner already loses access to these on delete, so removing them changes
  // nothing for them.
  const { data: cardRow } = await admin
    .from("cards")
    .select("username")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!cardRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const username = cardRow.username as string;

  // Lead-child rows are keyed by lead_id, so they must be cleared BEFORE the
  // leads themselves — otherwise deleting the card orphaned every message and
  // reminder belonging to its contacts. Same children the account purge clears.
  const { data: cardLeads } = await admin.from("leads").select("id").eq("card_owner", username);
  const cardLeadIds = (cardLeads ?? []).map((l) => l.id as string).filter(Boolean);
  if (cardLeadIds.length) {
    await Promise.all([
      admin.from("lead_messages").delete().in("lead_id", cardLeadIds).then(() => {}, () => {}),
      admin.from("lead_reminders").delete().in("lead_id", cardLeadIds).then(() => {}, () => {}),
    ]);
  }

  await Promise.all([
    admin.from("leads").delete().eq("card_owner", username),
    // Slug-keyed like the rest — otherwise the next owner of this slug inherits it.
    admin.from("analytics_events").delete().eq("username", username).then(() => {}, () => {}),
    admin.from("card_views").delete().in("username", [username, `${username}__links`]),
    admin.from("card_events").delete().eq("card_owner_username", username),
    admin.from("notifications").delete().eq("user_id", user.id).eq("card_owner", username).then(() => {}, () => {}),
    // Stored card IMAGES are keyed by slug too, in PUBLIC buckets. Without this
    // they outlive the card forever: the deleted card's full image (name, phone,
    // email, headshot) stays downloadable at its public URL, and whoever
    // registers this freed slug next would have THEIR link previews and email
    // signatures serve THIS card's image. Same cross-account reasoning as the
    // table cleanup above. Best-effort — a missing object must not fail the delete.
    admin.storage.from("card-shares").remove([`${username}.png`]).then(() => {}, () => {}),
    admin.storage.from("card-signatures").remove([`${username}.png`]).then(() => {}, () => {}),
  ]);

  const { error } = await admin
    .from("cards")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ card: data });
}
