import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isCardActive } from "@/lib/card-active";
import { isOwnerRequest } from "@/lib/self-traffic";
import { isRateLimited } from "@/lib/rate-limit";

// Cap the stored event payload so this public, unauthenticated endpoint can't be
// used to bloat the analytics table with an oversized blob.
const MAX_EVENT_DATA_BYTES = 4 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { username, event_type, event_data } = await req.json();
    if (!username || typeof username !== "string" || !event_type || typeof event_type !== "string") {
      return NextResponse.json({ ok: true });
    }

    // Public, unauthenticated endpoint — cap per (IP, slug) exactly like the
    // views / card-events ingest routes so a known slug can't be looped to flood
    // the analytics table.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    if (await isRateLimited(`analytics:${ip}:${username}`, 40, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: true, rateLimited: true });
    }

    // Only record events for a real, active card — matches the views/card-events
    // ingest endpoints. Without this, an arbitrary username could pollute the
    // analytics table for a slug nobody owns.
    if (!(await isCardActive(username))) return NextResponse.json({ ok: true });

    const admin = getAdminSupabase();

    // Owner self-activity never records — an owner opening/testing their own card
    // or SwiftLink must not appear in their own analytics. Server-side, session
    // based, so it holds for stale tabs / direct POSTs regardless of any client
    // suppression. Only the true owner is excluded (see self-traffic.ts).
    if (await isOwnerRequest(admin, username)) {
      return NextResponse.json({ ok: true, self: true });
    }

    // Bound the payload size before storing it.
    let safeData: Record<string, unknown> = {};
    if (event_data && typeof event_data === "object" && !Array.isArray(event_data)) {
      try {
        if (JSON.stringify(event_data).length <= MAX_EVENT_DATA_BYTES) {
          safeData = event_data as Record<string, unknown>;
        }
      } catch { /* non-serializable — store empty */ }
    }

    await admin.from("analytics_events").insert({ username, event_type, event_data: safeData });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never fail silently
  }
}
