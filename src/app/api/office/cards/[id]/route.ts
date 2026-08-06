import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireOfficeCapability } from "@/lib/office-roles";
import { officeOwnsCard, isOwnersCard } from "@/lib/office-cards";
import { getOfficeBrand, overlayOfficeContact, overlayOfficeDesign } from "@/lib/office-brand";
import { normalizeSocial } from "@/lib/social-url";
import { writeAudit } from "@/lib/audit";
import { cardContentChanged } from "@/lib/card-changed";

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

  // Snapshot BEFORE the write. Two uses: merging customization (below), and
  // telling afterwards whether anything the card SHOWS actually changed.
  //
  // Every ON_CARD_SCALARS column must be listed. A column missing here reads as
  // undefined and makes an unchanged value look like an edit — the exact false
  // positive this snapshot exists to prevent. Written out literally because the
  // typed Supabase client cannot parse an interpolated select; a test asserts
  // this string stays in sync with ON_CARD_SCALARS.
  const { data: beforeCard } = await admin
    .from("cards")
    .select("username, user_id, customization, name, title, company, phone, email, website, linkedin, instagram, twitter, tiktok, template, logo_url")
    .eq("id", id)
    .maybeSingle();

  // Merge customization onto the card's own existing blob so keys the admin's
  // form doesn't send (bio, links, testimonials, the employee's headshot) aren't
  // wiped. Server-owned "_"-prefixed keys never come from the client.
  if ("customization" in updates) {
    const existingCard = beforeCard;
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

  // An office admin editing an employee's card leaves the same two cached
  // artifacts stale that the employee's own save invalidates: the share-preview
  // PNG (what iMessage/WhatsApp show for the card link) and the Swift Signature
  // image automated emails sign off with. This route updated the row and went
  // straight to the audit write, so an admin-side edit — a new company name, a
  // corrected title — left both surfaces showing the OLD card indefinitely.
  // Mirrors api/cards/[id]; best-effort, never blocks the save.
  // Compared against the pre-write snapshot, exactly as the employee's own save
  // does (lib/card-changed). This used to be `some(k => k !== "is_offline")` —
  // "a field was SUBMITTED", not "a value CHANGED" — so an admin opening an
  // employee's card and pressing Save without touching anything deleted both
  // cached PNGs and told that employee their card had changed. `label` is an
  // internal name and is deliberately not an on-card field, so renaming a card
  // no longer nags either.
  const contentChanged = !!beforeCard && cardContentChanged(beforeCard as Record<string, unknown>, updates);
  if (contentChanged) {
    try {
      const uname = beforeCard?.username as string | undefined;
      const cardOwnerId = beforeCard?.user_id as string | null | undefined;
      if (uname) {
        admin.storage.from("card-shares").remove([`${uname}.png`]).then(() => {}, () => {});
        admin.storage.from("card-signatures").remove([`${uname}.png`]).then(() => {}, () => {});
        // The reminder goes to the EMPLOYEE whose signature it is, not the admin
        // who made the edit. One unread reminder per card is enough.
        if (cardOwnerId) {
          const { data: pending } = await admin
            .from("notifications")
            .select("id")
            .eq("user_id", cardOwnerId)
            .eq("type", "signature_stale")
            .eq("card_owner", uname)
            .eq("read", false)
            .limit(1);
          if (!pending?.length) {
            const { insertNotification } = await import("@/lib/notify");
            await insertNotification({
              user_id: cardOwnerId,
              card_owner: uname,
              type: "signature_stale",
              title: "Update your email signature",
              body: "Your team admin updated your card — re-copy your Swift Signature so the version in your email matches.",
            });
          }
        }
      }
    } catch { /* freshness is a nicety; the card save must still succeed */ }
  }

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
