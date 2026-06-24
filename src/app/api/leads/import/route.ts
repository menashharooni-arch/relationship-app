import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

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

  const { leads } = await request.json() as { leads: LeadRow[] };
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "no_leads" }, { status: 400 });
  }

  const rows = leads
    .filter((l) => l.name || l.email)
    .slice(0, 500)
    .map((l) => ({
      name: l.name || l.email || "Unknown",
      email: l.email || "",
      phone: l.phone || null,
      message: l.company ? `Company: ${l.company}` : null,
      card_owner: profile.username,
      tags: ["imported"],
    }));

  const { error, count } = await admin
    .from("leads")
    .insert(rows, { count: "exact" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: count ?? rows.length });
}
