import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireOfficeCapability } from "@/lib/office-roles";
import { officeOwnsCard, isOwnersCard } from "@/lib/office-cards";
import { getOfficeBrand, overlayOfficeContact, overlayOfficeDesign } from "@/lib/office-brand";
import { normalizeSocial } from "@/lib/social-url";
import { writeAudit } from "@/lib/audit";

// The office admin edits an employee's PERSONAL details and can take the card
// offline. Company-controlled fields (logo/company/website/office contact) and
// the locked look are deliberately NOT editable here — they're set once on the
// Branding page for the whole team.
const ALLOWED = ["name", "title", "phone", "email", "linkedin", "instagram", "twitter", "tiktok", "customization", "label"];
const SOCIAL_COLUMNS = ["linkedin", "instagram", "twitter", "tiktok"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOfficeCapability(user.id, "manage_member_cards");
  if (!ctx) return NextResponse.json({ error: "You don't have permission to manage team cards." }, { status: 403 });

  // Authorization gate: the card must belong to THIS office (owner or an active
  // member). Without this, any office admin could edit any card by id.
  if (!(await officeOwnsCard(ctx.officeId, id))) {
    return NextResponse.json({ error: "That card isn't part of your team." }, { status: 404 });
  }

  const admin = getAdminSupabase();

  // manage_member_cards means "any EMPLOYEE's card" — the office OWNER's own
  // card is exempt from a delegated (non-owner) admin's reach here. Without
  // this, officeOwnsCard's controlled-user set (which includes the owner)
  // would let a non-owner admin edit or take offline the owner's own card.
  if (!ctx.isOwner) {
    const { data: targetCard } = await admin.from("cards").select("user_id").eq("id", id).maybeSingle();
    if (isOwnersCard(ctx.ownerId, targetCard?.user_id as string | null | undefined)) {
      return NextResponse.json({ error: "Only the office owner can edit their own card." }, { status: 403 });
    }
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key];
  }
  for (const key of SOCIAL_COLUMNS) {
    if (key in updates) updates[key] = normalizeSocial(String(updates[key] ?? ""), key);
  }

  // Take offline / bring back online. Hides the public card without deleting it.
  const offlineChanged = typeof body.is_offline === "boolean";
  if (offlineChanged) updates.is_offline = body.is_offline;

  if (!Object.keys(updates).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  // Merge customization onto the card's own existing blob so keys the admin's
  // form doesn't send (bio, links, testimonials, the employee's headshot) aren't
  // wiped. Server-owned "_"-prefixed keys never come from the client.
  if ("customization" in updates) {
    const { data: existingCard } = await admin.from("cards").select("customization").eq("id", id).maybeSingle();
    const incoming = { ...(updates.customization as Record<string, unknown>) };
    for (const k of Object.keys(incoming)) if (k.startsWith("_")) delete incoming[k];
    let merged: Record<string, unknown> = {
      ...((existingCard?.customization as Record<string, unknown> | null) ?? {}),
      ...incoming,
    };
    // Re-assert the office brand, exactly as the card owner's own save would.
    // No card is exempt — the brand lives on the Branding page, and every card
    // under the office (the owner's included) carries it uniformly.
    {
      const brand = await getOfficeBrand(ctx.officeId);
      if (brand) {
        if (brand.phone || brand.fax || brand.address) merged = overlayOfficeContact(merged, brand);
        merged = overlayOfficeDesign(merged, brand);
      }
    }
    updates.customization = merged;
  }

  const { error } = await admin.from("cards").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (offlineChanged) {
    await writeAudit({
      action: body.is_offline ? "card.taken_offline" : "card.brought_online",
      actorId: user.id,
      orgId: ctx.officeId,
      targetId: id,
    });
  }

  return NextResponse.json({ ok: true });
}
