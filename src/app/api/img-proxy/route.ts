import { NextRequest, NextResponse } from "next/server";
import { safeFetch } from "@/lib/safe-fetch";
import { isRateLimited } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

// Node runtime — the SSRF guard uses node:dns / node:net to resolve + vet IPs.
export const runtime = "nodejs";

// Same-origin image proxy so html2canvas can read cross-origin card images
// (Google/OAuth avatars, external logos) without tainting the canvas. SSRF is
// enforced by safeFetch: resolves the host, blocks private/loopback IPs, and
// re-checks every redirect hop (a hostname-only allowlist was bypassable via
// a public host that redirects to 169.254.169.254 / DNS-rebinds to a private IP).
//
// What comes back is served FROM swiftcard.me, so it must never be able to act
// as a page. An SVG opened directly (not as an <img>) runs its <script> with
// this origin — a one-link account takeover (security audit 2026-09-24). So:
// only image types, a `sandbox` CSP that turns off script even for a top-level
// SVG, nosniff, and a size cap read under the same timeout as the headers.

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon|bmp)$/i;

async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > max) return null;
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function GET(req: NextRequest) {
  // Even with SSRF fully guarded, this is an outbound fetch/bandwidth relay if
  // left unthrottled — cap per client IP like the other public ingest routes.
  const ip = clientIp(req);
  if (await isRateLimited(`imgproxy:${ip}`, 120, 10 * 60 * 1000)) {
    return new NextResponse("rate_limited", { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("missing url", { status: 400 });

  let target: URL;
  try { target = new URL(raw); } catch { return new NextResponse("bad url", { status: 400 }); }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await safeFetch(target.toString(), {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SwiftCard/1.0)" },
    });
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!res.ok || !IMAGE_TYPE.test(ct)) return new NextResponse("not an image", { status: 404 });

    const buf = await readCapped(res, MAX_BYTES);
    if (!buf) return new NextResponse("too large", { status: 413 });
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="image"',
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("error", { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
