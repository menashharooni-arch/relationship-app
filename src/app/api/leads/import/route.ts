import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";

type LeadRow = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
};

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, username")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "enterprise") {
    return NextResponse.json({ error: "enterprise_required" }, { status: 403 });
  }

  const { leads, card_owner } = await request.json() as { leads: LeadRow[]; card_owner?: string };
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "no_leads" }, { status: 400 });
  }

  // Import into the requested card only if the caller actually owns it;
  // otherwise fall back to the primary profile card.
  const owned = await getOwnerUsernames(user.id);
  const targetCard = card_owner && owned.includes(card_owner) ? card_owner : profile.username;

  const rows = leads
    .filter((l) => l.name || l.email)
    .slice(0, 500)
    .map((l) => ({
      name: l.name || l.email || "Unknown",
      email: l.email || "",
      phone: l.phone || null,
      message: l.company ? `Company: ${l.company}` : null,
      card_owner: targetCard,
      tags: ["imported"],
    }));

  const { error, count } = await admin
    .from("leads")
    .insert(rows, { count: "exact" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: count ?? rows.length });
}
