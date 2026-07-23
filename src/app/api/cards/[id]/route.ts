import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";
import { getMemberBrandForUser, overlayOfficeContact, overlayOfficeDesign, findManagedFieldViolations } from "@/lib/office-brand";
import { normalizeSocial } from "@/lib/social-url";
import { getOfficeSubUserContext } from "@/lib/office-roles";

const ALLOWED = ["name", "title", "company", "phone", "email", "website", "linkedin", "instagram", "twitter", "tiktok", "template", "customization", "logo_url", "label"];
const SOCIAL_COLUMNS = ["linkedin", "instagram", "twitter", "tiktok"] as const;

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
  await Promise.all([
    admin.from("leads").delete().eq("card_owner", username),
    admin.from("card_views").delete().in("username", [username, `${username}__links`]),
    admin.from("card_events").delete().eq("card_owner_username", username),
    admin.from("notifications").delete().eq("user_id", user.id).eq("card_owner", username).then(() => {}, () => {}),
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
