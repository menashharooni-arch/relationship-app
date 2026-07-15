// Trusted client IP for rate-limit keys.
//
// The LEFTMOST `x-forwarded-for` entry is attacker-controlled: any external
// client can prepend a fake IP and mint a fresh rate-limit bucket per request,
// defeating the limit entirely. On Vercel the platform sets `x-real-ip` to the
// real TCP peer, and appends the true client IP as the LAST hop of XFF. So we
// trust `x-real-ip` first, then the last XFF hop — never XFF[0].
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return "unknown";
}
