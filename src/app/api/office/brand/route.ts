import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { resolveBrandTargetIds } from "@/lib/office-brand-targets";
import { overlayOfficeContact } from "@/lib/office-brand";
import { writeAudit } from "@/lib/audit";
import { requireOfficeCapability } from "@/lib/office-roles";

// Office admin sets the uniform brand (logo / company / website / template).
// Saves it on the office AND propagates it to every existing card under the
// office (the admin's + every active member's), so all cards stay uniform.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  // Server-side authorization: caller must have manage_branding (owner or admin).
  const ctx = await requireOfficeCapability(user.id, "manage_branding");
  if (!ctx) return NextResponse.json({ error: "You don't have permission to manage branding." }, { status: 403 });

  // The office OWNER must currently be on a paid Office plan (the offices row
  // survives a cancel, so a downgraded team must not keep rewriting live cards).
  const { data: ownerProfile } = await admin.from("profiles").select("plan").eq("id", ctx.ownerId).maybeSingle();
  if (ownerProfile?.plan !== "enterprise") {
    return NextResponse.json({ error: "An active Office subscription is required." }, { status: 403 });
  }
  const { data: office } = await admin
    .from("offices")
    .select("id, brand_logo_url, brand_company, brand_website, brand_template")
    .eq("id", ctx.officeId)
    .maybeSingle();
  if (!office) return NextResponse.json({ error: "No office found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Company-controlled contact (spec §8) + template lock (spec §9).
  const addrIn = (body.address ?? null) as { street?: string; unit?: string; city?: string; state?: string; zip?: string } | null;
  const cleanAddr = addrIn && typeof addrIn === "object"
    ? {
        street: (addrIn.street ?? "").toString().trim(),
        unit: (addrIn.unit ?? "").toString().trim(),
        city: (addrIn.city ?? "").toString().trim(),
        state: (addrIn.state ?? "").toString().trim(),
        zip: (addrIn.zip ?? "").toString().trim(),
      }
    : null;
  const hasAddr = !!cleanAddr && Object.values(cleanAddr).some(Boolean);
  const lockTemplate = body.lockTemplate !== false; // default: locked (uniform template)

  const brand = {
    brand_logo_url: typeof body.logoUrl === "string" && body.logoUrl ? body.logoUrl : null,
    brand_company: typeof body.company === "string" ? body.company.trim() || null : null,
    brand_website: typeof body.website === "string" ? body.website.trim() || null : null,
    brand_template: typeof body.template === "string" && body.template ? body.template : null,
    brand_phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
    brand_fax: typeof body.fax === "string" ? body.fax.trim() || null : null,
    brand_address: hasAddr ? cleanAddr : null,
    brand_locks: { template: lockTemplate },
  };

  // Save, retrying without the newer columns if the migration isn't run yet, so
  // the core logo/company/website/template save never fails.
  let { error } = await admin.from("offices").update(brand).eq("id", office.id);
  if (error) {
    ({ error } = await admin.from("offices").update({
      brand_logo_url: brand.brand_logo_url, brand_company: brand.brand_company,
      brand_website: brand.brand_website, brand_template: brand.brand_template,
    }).eq("id", office.id));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Propagate to all cards owned by the admin + every active member. Cross-check
  // profiles.office_id too, not just office_members.status='active' — a member
  // who switched teams or whose office's subscription lapsed must not have their
  // live card overwritten with this office's branding just because a stale
  // office_members row wasn't cleaned up somewhere.
  const { data: members } = await admin
    .from("office_members")
    .select("user_id")
    .eq("office_id", office.id)
    .eq("status", "active");
  const memberIds = (members ?? []).map((m) => m.user_id).filter(Boolean) as string[];
  let verifiedInOffice: string[] = [];
  if (memberIds.length) {
    const { data: stillHere } = await admin
      .from("profiles")
      .select("id")
      .in("id", memberIds)
      .eq("office_id", office.id);
    verifiedInOffice = (stillHere ?? []).map((p) => p.id as string);
  }
  // Owner + members still verifiably in this office (intersection). A stale
  // office_members row alone never grants a rebrand — see office-brand-targets.
  const userIds = resolveBrandTargetIds(user.id, memberIds, verifiedInOffice);

  const cardUpdate: Record<string, unknown> = {};
  if (brand.brand_logo_url) cardUpdate.logo_url = brand.brand_logo_url;
  if (brand.brand_company) cardUpdate.company = brand.brand_company;
  if (brand.brand_website) cardUpdate.website = brand.brand_website;
  if (lockTemplate && brand.brand_template) cardUpdate.template = brand.brand_template; // only force template when locked

  if (Object.keys(cardUpdate).length && userIds.length) {
    await admin.from("cards").update(cardUpdate).in("user_id", userIds);
  }

  // Card nickname is company-controlled on MEMBER cards only (sourced from the
  // company name) — the owner's own card labels are theirs. verifiedInOffice is
  // the members-only subset of userIds, so the owner is naturally excluded.
  if (brand.brand_company && verifiedInOffice.length) {
    await admin.from("cards").update({ label: brand.brand_company }).in("user_id", verifiedInOffice);
  }

  // Company phone/fax/address live in customization → per-card overlay so every
  // member card carries the uniform company contact (spec §8), preserving each
  // card's personal fields.
  if (userIds.length && (brand.brand_phone || brand.brand_fax || brand.brand_address)) {
    const contact = { phone: brand.brand_phone, fax: brand.brand_fax, address: brand.brand_address };
    const { data: memberCards } = await admin.from("cards").select("id, customization").in("user_id", userIds);
    for (const c of memberCards ?? []) {
      const merged = overlayOfficeContact(c.customization as Record<string, unknown> | null, contact);
      await admin.from("cards").update({ customization: merged }).eq("id", c.id);
    }
  }

  // A brand field the owner just CLEARED must also come off the cards —
  // additive-only propagation left the old logo/company on every member card
  // forever. Only clear cards whose value still equals the OLD brand value, so
  // a personal value a member set themselves is never wiped.
  if (userIds.length) {
    const cleared: Array<{ column: "logo_url" | "company" | "website"; old: string; to: string | null }> = [];
    if (!brand.brand_logo_url && office.brand_logo_url) cleared.push({ column: "logo_url", old: office.brand_logo_url as string, to: null });
    if (!brand.brand_company && office.brand_company) cleared.push({ column: "company", old: office.brand_company as string, to: "" });
    // Company name cleared → member card nicknames that still carry it come off too.
    if (!brand.brand_company && office.brand_company && verifiedInOffice.length) {
      await admin.from("cards").update({ label: null }).in("user_id", verifiedInOffice).eq("label", office.brand_company as string);
    }
    if (!brand.brand_website && office.brand_website) cleared.push({ column: "website", old: office.brand_website as string, to: "" });
    for (const c of cleared) {
      await admin.from("cards").update({ [c.column]: c.to }).in("user_id", userIds).eq(c.column, c.old);
    }
  }

  await writeAudit({
    action: "brand.updated",
    actorId: user.id,
    orgId: office.id as string,
    metadata: { fields: Object.keys(cardUpdate), affectedUsers: userIds.length },
  });

  return NextResponse.json({ ok: true });
}
