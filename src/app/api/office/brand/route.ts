import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { resolveBrandTargetIds } from "@/lib/office-brand-targets";

// Office admin sets the uniform brand (logo / company / website / template).
// Saves it on the office AND propagates it to every existing card under the
// office (the admin's + every active member's), so all cards stay uniform.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  // Office ownership AND a currently-paid plan. The offices row survives a
  // subscription cancel, so without the plan recheck a downgraded ex-owner
  // could keep rewriting former members' live cards through this API.
  const { data: ownerProfile } = await admin.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  if (ownerProfile?.plan !== "enterprise") {
    return NextResponse.json({ error: "An active Office subscription is required." }, { status: 403 });
  }
  const { data: office } = await admin
    .from("offices")
    .select("id, brand_logo_url, brand_company, brand_website, brand_template")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!office) return NextResponse.json({ error: "Only the office owner can set branding." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const brand = {
    brand_logo_url: typeof body.logoUrl === "string" && body.logoUrl ? body.logoUrl : null,
    brand_company: typeof body.company === "string" ? body.company.trim() || null : null,
    brand_website: typeof body.website === "string" ? body.website.trim() || null : null,
    brand_template: typeof body.template === "string" && body.template ? body.template : null,
  };

  const { error } = await admin.from("offices").update(brand).eq("id", office.id);
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
  if (brand.brand_template) cardUpdate.template = brand.brand_template;

  if (Object.keys(cardUpdate).length && userIds.length) {
    await admin.from("cards").update(cardUpdate).in("user_id", userIds);
  }

  // A brand field the owner just CLEARED must also come off the cards —
  // additive-only propagation left the old logo/company on every member card
  // forever. Only clear cards whose value still equals the OLD brand value, so
  // a personal value a member set themselves is never wiped.
  if (userIds.length) {
    const cleared: Array<{ column: "logo_url" | "company" | "website"; old: string; to: string | null }> = [];
    if (!brand.brand_logo_url && office.brand_logo_url) cleared.push({ column: "logo_url", old: office.brand_logo_url as string, to: null });
    if (!brand.brand_company && office.brand_company) cleared.push({ column: "company", old: office.brand_company as string, to: "" });
    if (!brand.brand_website && office.brand_website) cleared.push({ column: "website", old: office.brand_website as string, to: "" });
    for (const c of cleared) {
      await admin.from("cards").update({ [c.column]: c.to }).in("user_id", userIds).eq(c.column, c.old);
    }
  }

  return NextResponse.json({ ok: true });
}
