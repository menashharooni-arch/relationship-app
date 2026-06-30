import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY one-off: set the menash card's website to swiftcard.me. Token-guarded; removed after use.
const TOKEN = "sc-oneoff-3p9w6m1z";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "nope" }, { status: 404 });
  }
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("cards")
    .update({ website: "swiftcard.me" })
    .eq("username", "menash")
    .select("username, website");
  return NextResponse.json({ ok: !error, error: error?.message, updated: data });
}
