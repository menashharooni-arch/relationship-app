import { NextRequest, NextResponse } from "next/server";

// Lightweight Open Graph image fetcher for Swift Links thumbnails ("the face of
// the page"). Fetches the target page with a browser-like UA, pulls og:image /
// twitter:image, caches per-instance, and degrades to null when blocked.

const cache = new Map<string, { image: string | null; at: number }>();
const TTL = 1000 * 60 * 60 * 24; // 24h

// Block obvious SSRF targets (this route fetches a user-supplied URL).
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  // Literal private/loopback/link-local IPv4 ranges.
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function extractImage(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      try { return new URL(m[1], baseUrl).toString(); } catch { return m[1]; }
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ image: null });

  let target: URL;
  try { target = new URL(raw.startsWith("http") ? raw : `https://${raw}`); }
  catch { return NextResponse.json({ image: null }); }
  if (!/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname)) {
    return NextResponse.json({ image: null });
  }

  const key = target.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ image: hit.image }, { headers: { "Cache-Control": "public, max-age=86400" } });
  }

  let image: string | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(target.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);

    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("text/html")) {
      // Only read up to ~150KB / through </head> — og tags live in the head.
      const reader = res.body?.getReader();
      let html = "";
      if (reader) {
        const dec = new TextDecoder();
        let total = 0;
        while (total < 150_000) {
          const { done, value } = await reader.read();
          if (done) break;
          html += dec.decode(value, { stream: true });
          total += value.byteLength;
          if (html.includes("</head>")) break;
        }
        reader.cancel().catch(() => {});
      } else {
        html = await res.text();
      }
      image = extractImage(html, target.toString());
    }
  } catch {
    image = null;
  }

  cache.set(key, { image, at: Date.now() });
  return NextResponse.json({ image }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
