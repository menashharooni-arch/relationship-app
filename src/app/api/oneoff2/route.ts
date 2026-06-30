import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY diagnostic: look up a user's card usernames to verify the card page renders.
// Token-guarded; removed immediately after use.
const TOKEN = "sc-oneoff-7t3k9w2p";
const UID = "50d0850d-9d9d-4315-918a-9191308332eb";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "nope" }, { status: 404 });
  }
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("cards").select("username, name, template").eq("user_id", UID);
  return NextResponse.json({ ok: !error, error: error?.message, cards: data });
}
