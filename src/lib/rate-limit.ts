// Simple in-process rate limiter. NOTE: on serverless this is per-instance
// memory, so it throttles bursts to one warm instance rather than enforcing a
// hard global cap — good enough to blunt inbox-flood / quota-burn abuse on the
// public endpoints (lead capture, contact form). For a hard global limit, back
// this with Redis/Upstash later.
const rateMap = new Map<string, { count: number; resetAt: number }>();

/** True if `key` has exceeded `max` hits within `windowMs`. Defaults: 3 / 10 min. */
export function isRateLimited(key: string, max = 3, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}
