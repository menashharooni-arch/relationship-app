import { NextRequest, NextResponse } from "next/server";
import { safeFetch } from "@/lib/safe-fetch";
import { isRateLimited } from "@/lib/rate-limit";

// Node runtime — the SSRF guard uses node:dns / node:net to resolve + vet IPs.
export const runtime = "nodejs";

// Same-origin image proxy so html2canvas can read cross-origin card images
// (Google/OAuth avatars, external logos) without tainting the canvas. SSRF is
// enforced by safeFetch: resolves the host, blocks private/loopback IPs, and
// re-checks every redirect hop (a hostname-only allowlist was bypassable via
// a public host that redirects to 169.254.169.254 / DNS-rebinds to a private IP).

export async function GET(req: NextRequest) {
  // Even with SSRF fully guarded, this is an outbound fetch/bandwidth relay if
  // left unthrottled — cap per client IP like the other public ingest routes.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip") ?? "unknown";
  if (await isRateLimited(`imgproxy:${ip}`, 120, 10 * 60 * 1000)) {
    return new NextResponse("rate_limited", { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("missing url", { status: 400 });

  let target: URL;
  try { target = new URL(raw); } catch { return new NextResponse("bad url", { status: 400 }); }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await safeFetch(target.toString(), {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SwiftCard/1.0)" },
    });
    clearTimeout(timer);
    const ct = res.headers.get("content-type") || "image/png";
    if (!res.ok || !ct.startsWith("image/")) return new NextResponse("not an image", { status: 404 });

    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("error", { status: 502 });
  }
}
