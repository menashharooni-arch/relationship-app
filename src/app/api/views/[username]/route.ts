import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";
import { recordView } from "@/lib/record-view";
import { clientIp } from "@/lib/client-ip";
import { isLikelyBot } from "@/lib/bot-detection";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: rawUsername } = await params;
  const username = rawUsername.toLowerCase();

  // Public, unauthenticated endpoint — cap per (IP, card) so a caller that
  // omits visitorId (bypassing the reload-dedup below entirely) can't loop
  // this to inflate a card's view count or spam its owner's view-milestone
  // notifications.
  const ip = clientIp(req)
    ?? "unknown";
  if (await isRateLimited(`views:${ip}:${username}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: true, rateLimited: true });
  }

  // Bot/crawler/synthetic-monitor traffic never counts as a real view. Checked
  // against the actual request header (not the client-supplied device_info),
  // so it holds even against a direct scripted POST.
  if (isLikelyBot(req.headers.get("user-agent"))) {
    return NextResponse.json({ ok: true, bot: true });
  }

  // Browser prefetch/prerender/link-preview machinery announces itself in
  // these headers. Our tracker fires from a user-visible page (and skips
  // document.prerendering itself), so anything that arrives pre-flagged is a
  // speculative load, not a person.
  const purpose = `${req.headers.get("sec-purpose") ?? ""} ${req.headers.get("purpose") ?? ""} ${req.headers.get("x-purpose") ?? ""}`.toLowerCase();
  if (/prefetch|prerender|preview/.test(purpose)) {
    return NextResponse.json({ ok: true, prefetch: true });
  }

  const body = await req.json().catch(() => null);
  // Type + length validation: both fields are permanent row values and the
  // dedup/traffic-source pipelines key on them, so a non-string or unbounded
  // payload must degrade to "absent", never reach the database. (Recorded
  // source values aren't validated against SOURCE_LABELS — an unrecognized
  // value just falls back to its raw string in the UI via getSourceLabel.)
  const visitorId: string | null =
    typeof body?.visitorId === "string" && body.visitorId.trim()
      ? body.visitorId.trim().slice(0, 64)
      : null;
  const source: string | null =
    typeof body?.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 48)
      : null;

  // Everything from here — active-card check, owner self-view skip, the
  // VIEW_VISIT_WINDOW_MS dedupe, the insert, CRM mirror and milestone — lives
  // in lib/record-view.ts so /api/card-events records the SAME row before it
  // notifies (one request, one truth; see that file).
  const { outcome } = await recordView({ req, username, visitorId, source, ip });
  if (outcome === "self") return NextResponse.json({ ok: true, self: true });
  if (outcome === "deduped") return NextResponse.json({ ok: true, deduped: true });
  return NextResponse.json({ ok: true });
}
