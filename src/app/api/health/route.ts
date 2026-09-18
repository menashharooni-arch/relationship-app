import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { checkApnsCredentials } from "@/lib/apns";

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
  // PUSH CREDENTIALS. Reported, never part of `ok`: a broken APNs key must not
  // take the site's health down with it, but it must be VISIBLE — for a week in
  // 2026-09 not one notification reached a phone and nothing anywhere said so.
  // Booleans and Apple's reason word only; no key material. scripts/health-check
  // turns these into an alert.
  let push: { apns: { configured: boolean; ok: boolean; reason: string }; webPush: boolean } | null = null;
  try {
    push = {
      apns: await checkApnsCredentials(),
      webPush: !!process.env.VAPID_PRIVATE_KEY && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    };
  } catch { push = null; }
  return NextResponse.json(
    { ok: db, db, dbMs: Date.now() - t0, push },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
