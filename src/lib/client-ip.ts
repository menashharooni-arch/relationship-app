// Trusted client IP for rate-limit keys.
//
// The LEFTMOST `x-forwarded-for` entry is attacker-controlled: any external
// client can prepend a fake IP and mint a fresh rate-limit bucket per request,
// defeating the limit entirely. On Vercel the platform sets `x-real-ip` to the
// real TCP peer, and appends the true client IP as the LAST hop of XFF. So we
// trust `x-real-ip` first, then the last XFF hop — never XFF[0].
export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers);
}

// Same rule, for callers holding a headers object rather than a Request (server
// components / server actions using next/headers). Keeping both on one
// implementation means there's a single definition of "the trusted client IP".
export function clientIpFromHeaders(h: { get(name: string): string | null }): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return "unknown";
}
