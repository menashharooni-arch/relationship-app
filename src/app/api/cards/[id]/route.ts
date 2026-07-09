import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";
import { getOfficeBrandForUser } from "@/lib/office-brand";

const ALLOWED = ["name", "title", "company", "phone", "email", "website", "linkedin", "instagram", "twitter", "tiktok", "template", "customization", "logo_url", "label"];

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

  const admin = getAdminSupabase();

  // Enforce Pro-only features on the backend: custom template, Pro-only design
  // keys (accent/font), and the link-button cap — all stripped for non-paid.
  const { data: planRow } = await admin.from("profiles").select("plan").eq("id", user.id).single();
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
          { error: "view_only", message: "This card is view-only on Free. Upgrade to Pro to edit all your cards.", upgrade: "/pricing" },
          { status: 403 }
        );
      }
    }
    if (updates.template === "custom") updates.template = "classic-pro";
  }

  // Merge the incoming customization onto THIS card's existing customization
  // (same card, ownership-scoped) rather than replacing the whole JSON. The form
  // only sends the keys it manages, so without this a key it doesn't send (e.g.
  // testimonials, or any future field) would be silently wiped on save. Merging
  // the card's OWN data can never introduce cross-card bleed — form keys win,
  // omitted keys are preserved. Free plans still have Pro-only keys stripped.
  if ("customization" in updates) {
    const { data: existingCard } = await admin
      .from("cards")
      .select("customization")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    // Server-owned "_"-prefixed keys never come from the client — strip any the
    // payload tries to send so a crafted request can't overwrite internal flags.
    const incoming = { ...(updates.customization as Record<string, unknown>) };
    for (const k of Object.keys(incoming)) if (k.startsWith("_")) delete incoming[k];
    const merged = {
      ...((existingCard?.customization as Record<string, unknown> | null) ?? {}),
      ...incoming,
    };
    updates.customization = isPaidPlan(planRow?.plan) ? merged : sanitizeCustomizationForPlan(merged, false);
  }

  // Office uniform branding: force brand fields so members can't override them.
  const brand = await getOfficeBrandForUser(user.id);
  if (brand) {
    if (brand.logoUrl) updates.logo_url = brand.logoUrl;
    if (brand.company) updates.company = brand.company;
    if (brand.website) updates.website = brand.website;
    if (brand.template) updates.template = brand.template;
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
