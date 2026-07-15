import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";
import { readUsage, bumpUsage } from "@/lib/usage";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("username, plan, customization").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { name, email, phone, company, notes, where_met, card_owner: requestedOwner } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  // Attach the contact to the card the user currently has selected (validated to
  // belong to them), so it shows up in that card's scoped view. Falls back to the
  // profile's primary card if no/invalid card was passed.
  const { data: ownCards } = await admin.from("cards").select("username").eq("user_id", user.id);
  const ownUsernames = (ownCards ?? []).map((c) => c.username);
  const finalOwner =
    typeof requestedOwner === "string" && ownUsernames.includes(requestedOwner)
      ? requestedOwner
      : profile.username;

  // Manual adds count against the same monthly free-lead meter (5/month, on the
  // account so it survives card deletion). A deliberate owner action, so we hard-
  // block at the cap with an upgrade prompt rather than silently locking.
  const paid = isPaidPlan(profile.plan);
  if (!paid && readUsage(profile.customization).leads >= PLAN_LIMITS.FREE_LEADS_PER_MONTH) {
    return NextResponse.json(
      {
        // Machine code for the native app (platform-agnostic). Additive only —
        // web keeps using message/error/upgrade byte-for-byte.
        code: "LEAD_LIMIT_REACHED",
        error: "limit",
        message: `You've captured your ${PLAN_LIMITS.FREE_LEADS_PER_MONTH} free leads this month. Upgrade to Pro to add unlimited contacts.`,
        upgrade: "/pricing",
      },
      { status: 402 }
    );
  }

  const { data, error } = await admin
    .from("leads")
    .insert({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      notes: notes?.trim() || null,
      where_met: where_met?.trim() || null,
      card_owner: finalOwner,
      source: "manual",
      status: "new_contact",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!paid) await bumpUsage(admin, user.id, profile.customization as Record<string, unknown> | null, "leads");
  return NextResponse.json({ lead: data });
}
