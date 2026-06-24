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
    .select("name, email, phone, company, status, notes, follow_up_date, created_at")
    .eq("card_owner", profile.username)
    .order("created_at", { ascending: false });

  function esc(v: string | null | undefined) {
    return `"${(v ?? "").replace(/"/g, '""')}"`;
  }

  const rows = (leads ?? []).map((l) => [
    esc(l.name),
    esc(l.email),
    esc(l.phone),
    esc(l.company),
    esc(l.status || "new"),
    esc(l.notes),
    esc(l.follow_up_date ? l.follow_up_date.slice(0, 10) : null),
    esc(new Date(l.created_at).toLocaleDateString()),
  ].join(","));

  const csv = ["Name,Email,Phone,Company,Status,Notes,Follow-up date,Date added", ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="swiftcard-leads.csv"`,
    },
  });
}
