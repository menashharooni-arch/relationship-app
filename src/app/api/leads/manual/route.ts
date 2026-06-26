import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("username, plan").eq("id", user.id).single();
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

  // Enforce the same free-plan contact limit as the public capture route.
  // Only blocks NEW adds — existing contacts are never removed.
  if (!isPaidPlan(profile.plan)) {
    const { count } = await admin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("card_owner", finalOwner);
    if ((count ?? 0) >= PLAN_LIMITS.FREE_CONTACT_LIMIT) {
      return NextResponse.json(
        {
          error: "limit",
          message: `You've reached the free plan's ${PLAN_LIMITS.FREE_CONTACT_LIMIT}-contact limit. Upgrade to Pro for unlimited contacts.`,
          upgrade: "/pricing",
        },
        { status: 402 }
      );
    }
  }

  const fullNotes = [
    notes?.trim(),
    where_met?.trim() ? `Met at: ${where_met.trim()}` : null,
  ].filter(Boolean).join("\n");

  const { data, error } = await admin
    .from("leads")
    .insert({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      notes: fullNotes || null,
      card_owner: finalOwner,
      source: "manual",
      status: "new_contact",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
