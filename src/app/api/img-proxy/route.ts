import { NextRequest, NextResponse } from "next/server";

// Same-origin image proxy so html2canvas can read cross-origin card images
// (Google/OAuth avatars, external logos) without tainting the canvas. SSRF-guarded.
function blockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("missing url", { status: 400 });

  let target: URL;
  try { target = new URL(raw); } catch { return new NextResponse("bad url", { status: 400 }); }
  if (!/^https?:$/.test(target.protocol) || blockedHost(target.hostname)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(target.toString(), {
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
