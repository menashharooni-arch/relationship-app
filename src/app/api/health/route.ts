import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Canonical health endpoint ────────────────────────────────────────────────
// One cheap, honest answer to "is the product alive right now?": the app is
// serving AND its database answers. Used by Performance Watch (every 4h) and
// available to uptime checks. Deliberately tiny — no auth, no user data, and
// the DB probe is a HEAD count on one table.
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  let db = false;
  try {
    const { error } = await getAdminSupabase().from("profiles").select("id", { count: "exact", head: true }).limit(1);
    db = !error;
  } catch { db = false; }
  return NextResponse.json(
    { ok: db, db, dbMs: Date.now() - t0 },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
