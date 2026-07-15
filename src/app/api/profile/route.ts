import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";
import { getOfficeSubUserContext } from "@/lib/office-roles";
import { getOfficeBrandForUser, overlayOfficeContact, overlayOfficeDesign, findManagedFieldViolations } from "@/lib/office-brand";

// `logo_url` was previously missing here, so a logo chosen in the legacy
// profile-card editor was silently dropped on save (cards audit H2).
const ALLOWED = ["template", "name", "title", "company", "phone", "email", "website", "linkedin", "instagram", "twitter", "tiktok", "customization", "logo_url"];

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key];
  }

  // Enforce Pro-only design gates server-side (accent/font + link cap + custom
  // template), so the legacy profile-card editor can't bypass them.
  const { data: planRow } = await supabase.from("profiles").select("plan, customization, company, website, logo_url, template").eq("id", user.id).single();

  // A soft-deleted account's access token stays valid for its remaining
  // lifetime (signOut only revokes the refresh token) — block writes here too,
  // not just the page-level redirect.
  if ((planRow?.customization as Record<string, unknown> | null)?._deleted === true) {
    return NextResponse.json({ error: "This account has been deleted." }, { status: 403 });
  }

  if (!isPaidPlan(planRow?.plan)) {
    if (updates.template === "custom") updates.template = "classic-pro";
    if ("customization" in updates) {
      updates.customization = sanitizeCustomizationForPlan(updates.customization as Record<string, unknown>, false);
    }
  }

  // MERGE incoming customization onto the CURRENT blob rather than replacing it,
  // so a key the form doesn't send (testimonials, or any future field) isn't
  // silently wiped on save — matching /api/cards/[id]. Server-owned "_"-prefixed
  // keys always keep their current values, never what the client sent.
  if ("customization" in updates) {
    const incoming = { ...(updates.customization as Record<string, unknown> ?? {}) };
    const current = (planRow?.customization ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(incoming)) if (key.startsWith("_")) delete incoming[key];
    const merged: Record<string, unknown> = { ...current, ...incoming };
    for (const [key, val] of Object.entries(current)) if (key.startsWith("_")) merged[key] = val;
    updates.customization = merged;
  }

  // Office SUB-USERS' legacy profile card is org-managed too — otherwise it was
  // a complete bypass of the uniform-brand guarantee (office audit H3): a
  // sub-user could publish an off-brand card at /card/<their-username>. Reject a
  // genuine off-brand change and force the company-controlled fields, exactly
  // like /api/cards/[id]. The office owner's own card is unaffected.
  const subCtx = await getOfficeSubUserContext(user.id);
  if (subCtx) {
    const brand = await getOfficeBrandForUser(user.id).catch(() => null);
    if (brand) {
      const violations = findManagedFieldViolations(body, brand, {
        company: planRow?.company,
        website: planRow?.website,
        logo_url: planRow?.logo_url,
        template: planRow?.template,
        customization: (planRow?.customization as Record<string, unknown> | null) ?? null,
      });
      if (violations.length) {
        return NextResponse.json(
          { error: "managed_by_org", message: `The ${violations.join(", ")} on this card ${violations.length > 1 ? "are" : "is"} managed by your organization.` },
          { status: 403 }
        );
      }
      if (brand.logoUrl) updates.logo_url = brand.logoUrl;
      if (brand.company) updates.company = brand.company;
      if (brand.website) updates.website = brand.website;
      if (brand.lockTemplate && brand.template) updates.template = brand.template;
      if ("customization" in updates) {
        if (brand.phone || brand.fax || brand.address) updates.customization = overlayOfficeContact(updates.customization as Record<string, unknown>, brand);
        updates.customization = overlayOfficeDesign(updates.customization as Record<string, unknown>, brand);
      }
    }
  }

  // logo_url writes go through the service-role client (profiles RLS may not
  // grant the column to the session client); everything else stays session-
  // scoped by user.id.
  const admin = getAdminSupabase();
  const { error } = await admin.from("profiles").update(updates).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
