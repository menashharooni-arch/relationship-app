import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY token-guarded one-off — removed immediately after use.
const TOKEN = "sc_oneoff_3f9aD2kQ8mZ1rL6tW0xYb5Hc7Jp4Ng";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("token") !== TOKEN) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const email = (sp.get("email") || "").trim().toLowerCase();
  const plan = (sp.get("plan") || "pro").trim();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const admin = getAdminSupabase();

  let userId: string | null = null;
  for (let page = 1; page <= 12 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const u = data.users.find((x) => (x.email || "").toLowerCase() === email);
    if (u) userId = u.id;
    if (data.users.length < 200) break;
  }
  if (!userId) return NextResponse.json({ error: "user not found", email }, { status: 404 });

  const { data, error } = await admin.from("profiles").update({ plan }).eq("id", userId).select("plan");
  if (error) return NextResponse.json({ error: error.message, userId }, { status: 500 });
  return NextResponse.json({ ok: true, email, plan, updated: data });
}
