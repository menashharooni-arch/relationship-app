import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { isRateLimited } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { isLikelyBot } from "@/lib/bot-detection";

// Cookie a site-owner sets on their own device (via the Website analytics page)
// so their and their partner's browsing is tagged internal and filtered out.
const INTERNAL_COOKIE = "sc_internal";

// Time on page is a real signal but easy to fat-finger via a scripted beacon;
// cap it at 30 minutes so one bad value can't skew the average.
const MAX_DURATION_MS = 30 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only keep the referrer HOST, and never our own domain (internal navigation
// isn't a referral). Full URLs can carry PII in query strings — host is enough.
function referrerHost(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    if (host === "swiftcard.me" || host === "swiftcard.app" || host === "localhost") return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: true });
  }

  // ── Duration beacon: { id, durationMs } updates an existing row ────────────
  if (body.event === "duration") {
    const id = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : null;
    const durationMs = Number(body.durationMs);
    if (!id || !Number.isFinite(durationMs) || durationMs <= 0) return NextResponse.json({ ok: true });
    const admin = getAdminSupabase();
    // Only ever set duration once (the pagehide beacon fires once per view);
    // guards against a later beacon clobbering a real value with a smaller one.
    await admin
      .from("site_pageviews")
      .update({ duration_ms: Math.min(Math.round(durationMs), MAX_DURATION_MS) })
      .eq("id", id)
      .is("duration_ms", null);
    return NextResponse.json({ ok: true });
  }

  // ── Pageview: record one row ──────────────────────────────────────────────
  // Never record dev/preview traffic — localhost and Vercel preview hosts share
  // the production database, so without this a developer's browsing would
  // pollute the owner's real website analytics.
  const host = req.headers.get("host") ?? "";
  const isRealSite = host === "swiftcard.me" || host === "swiftcard.app" || host === "www.swiftcard.me" || host === "www.swiftcard.app";
  if (!isRealSite) return NextResponse.json({ ok: true, skipped: "non_production_host" });

  const ip = clientIp(req) ?? "unknown";
  // Generous per-IP cap: enough for real browsing (dozens of pages), low enough
  // that a scripted loop can't flood the table.
  if (await isRateLimited(`site-view:${ip}`, 120, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: true, rateLimited: true });
  }

  // Bots/crawlers/synthetic monitors are not people — never counted.
  if (isLikelyBot(req.headers.get("user-agent"))) {
    return NextResponse.json({ ok: true, bot: true });
  }

  const id = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : crypto.randomUUID();
  const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : null;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.split(/[?#]/)[0].slice(0, 300) : null;
  if (!visitorId || !sessionId || !path) return NextResponse.json({ ok: true });

  // Internal traffic: the owner-set cookie, OR a signed-in admin (covers the
  // owner browsing while logged in, before they've set the cookie).
  let isInternal = req.cookies.get(INTERNAL_COOKIE)?.value === "1";
  if (!isInternal) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (isAdminEmail(user?.email)) isInternal = true;
    } catch { /* logged-out visitor — the common case */ }
  }

  const countryHeader = req.headers.get("x-vercel-ip-country");
  const country = countryHeader && /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : null;

  await getAdminSupabase().from("site_pageviews").insert({
    id,
    visitor_id: visitorId,
    session_id: sessionId,
    path,
    referrer: referrerHost(body.referrer),
    country,
    is_internal: isInternal,
  });

  return NextResponse.json({ ok: true, id });
}
