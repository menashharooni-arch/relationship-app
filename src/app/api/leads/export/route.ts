import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const { data: leads } = await supabase
    .from("leads")
    .select("name, email, phone, notes, created_at")
    .eq("card_owner", profile.username)
    .order("created_at", { ascending: false });

  const rows = (leads ?? []).map((l) => [
    `"${l.name}"`,
    `"${l.email}"`,
    `"${l.phone ?? ""}"`,
    `"${(l.notes ?? "").replace(/"/g, '""')}"`,
    `"${new Date(l.created_at).toLocaleDateString()}"`,
  ].join(","));

  const csv = ["Name,Email,Phone,Notes,Date", ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="evercard-leads.csv"`,
    },
  });
}
