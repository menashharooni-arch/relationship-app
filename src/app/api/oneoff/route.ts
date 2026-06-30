import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY one-off: upgrade a SINGLE hardcoded account to Pro. Token-guarded and
// scoped to one email so it can't affect anyone else. Remove right after use.
const TOKEN = "sc-oneoff-9q4m2x7v";
const TARGET_EMAIL = "menashharooni@gmail.com";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profiles")
    .update({ plan: "pro" })
    .ilike("email", TARGET_EMAIL)
    .select("id, email, plan");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: data });
}
