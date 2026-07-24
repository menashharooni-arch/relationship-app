import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";
import { reportError } from "@/lib/report-error";

// Receives client-side runtime errors (window.onerror / unhandledrejection /
// React error boundary) and funnels them through the SAME reportError pipeline
// the server paths use — so a glitch ANY user hits anywhere on the site is
// structured-logged and (if ALERT_WEBHOOK_URL is set) pings the team in real
// time, instead of being invisible. Heavily rate-limited + always 202: a broken
// client must never flood alerts, and reporting must never itself error.
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    // Cap alert volume: 20 client reports / IP / 10 min. Over that, silently drop.
    if (await isRateLimited(`client-error:${ip}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: true }, { status: 202 });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const message = String(body.message ?? "").slice(0, 500).trim();
    if (!message) return NextResponse.json({ ok: true });

    const context = `client.${String(body.context ?? "unknown").replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "unknown"}`;
    await reportError(context, new Error(message), {
      url: String(body.url ?? "").slice(0, 300),
      stack: String(body.stack ?? "").slice(0, 2000),
      ua: (req.headers.get("user-agent") ?? "").slice(0, 200),
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Reporting an error must never break — swallow everything.
    return NextResponse.json({ ok: true });
  }
}
