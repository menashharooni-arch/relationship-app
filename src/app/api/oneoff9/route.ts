import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY diagnostic: dump the demo card rows so the /preview inline card can match exactly.
const TOKEN = "sc-oneoff-4d8v2p6n";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) return NextResponse.json({ error: "nope" }, { status: 404 });
  const admin = getAdminSupabase();
  const { data } = await admin.from("cards").select("username, name, title, company, phone, email, website, logo_url, template, customization").in("username", ["demo-sales", "demo-realty"]);
  return NextResponse.json({ cards: data });
}
