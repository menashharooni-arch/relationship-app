import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";
import { recordView } from "@/lib/record-view";
import { clientIp } from "@/lib/client-ip";
import { isLikelyBot } from "@/lib/bot-detection";
import { attachVisitIdentity, deviceKeyFor, resolveVisitIdentity } from "@/lib/visit-identity";

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

  // The DURABLE identity, not the body's value. The sc_vid cookie wins over
  // the client's localStorage id, which is adopted (never overwritten) on
  // first sight and then kept server-side — see lib/visit-identity.ts for the
  // four-views-per-visit bug this closes.
  const identity = resolveVisitIdentity(req, visitorId);
  const deviceKey = deviceKeyFor({ ip, userAgent: req.headers.get("user-agent"), username });

  // Everything from here — active-card check, owner self-view skip, the
  // VIEW_VISIT_WINDOW_MS dedupe, the insert, CRM mirror and milestone — lives
  // in lib/record-view.ts so /api/card-events records the SAME row before it
  // notifies (one request, one truth; see that file).
  const { outcome } = await recordView({
    req, username, visitorId: identity.visitorId, deviceKey, source, ip,
  });

  // The cookie rides on EVERY outcome, including the declined ones. A view that
  // was deduped or refused is exactly the request whose next attempt has to be
  // recognisable as the same visit.
  //
  // `self` and `deduped` as before, and now `hosting` — which was the one
  // refusal reason with no outward sign at all: no flag here, and recordView
  // returns before anything reaches analytics_ingest_log, so a datacenter view
  // was indistinguishable from a recorded one except by counting rows.
  //
  // That silence cost a night of false alarms. The nightly guard runs on GitHub
  // Actions, which IS a datacenter, so its own views are refused — correctly —
  // and with nothing to read it could only report the pipeline as broken.
  // Saying so out loud is consistent with the three flags already here, and
  // tells a caller only its own IP's class, which it necessarily knows.
  //
  // "inactive" stays silent on purpose — telling a caller which slugs exist is
  // not this endpoint's job.
  const flag =
    outcome === "self"
      ? { self: true }
      : outcome === "deduped"
        ? { deduped: true }
        : outcome === "hosting"
          ? { hosting: true }
          : {};
  return attachVisitIdentity(NextResponse.json({ ok: true, ...flag }), identity);
}
