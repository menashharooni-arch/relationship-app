import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiting with a hard global cap when Upstash Redis is configured, and a
// per-instance in-memory fallback otherwise.
//
// The in-memory limiter (below) only throttles bursts hitting ONE warm
// serverless instance — under real load, requests spread across instances each
// keep their own counter, so the effective limit is looser than the number
// suggests. Setting UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN switches
// every caller to a shared sliding window in Redis with NO code changes, making
// the limits actually enforce globally. Without those env vars, behavior is
// exactly as before.

// ── In-memory fallback ──────────────────────────────────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>();
function inMemoryLimited(key: string, max: number, windowMs: number): boolean {
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

// ── Upstash (lazy, only when configured) ────────────────────────────────────
let redis: Redis | null = null;
let redisResolved = false;
function getRedis(): Redis | null {
  if (redisResolved) return redis;
  redisResolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) redis = new Redis({ url, token });
  return redis;
}

// One Ratelimit per (max, window) pair so different endpoints keep independent
// sliding windows without re-instantiating on every request.
const limiters = new Map<string, Ratelimit>();
function getLimiter(max: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const cacheKey = `${max}:${windowMs}`;
  let lim = limiters.get(cacheKey);
  if (!lim) {
    lim = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: "sc-rl",
      analytics: false,
    });
    limiters.set(cacheKey, lim);
  }
  return lim;
}

/** True if `key` has exceeded `max` hits within `windowMs`. Defaults: 3 / 10 min.
 *  Backed by Upstash Redis (hard global cap) when configured, else per-instance
 *  in-memory. Now async because the Redis path is a network call. */
export async function isRateLimited(key: string, max = 3, windowMs = 10 * 60 * 1000): Promise<boolean> {
  const limiter = getLimiter(max, windowMs);
  if (limiter) {
    try {
      const { success } = await limiter.limit(key);
      return !success;
    } catch (e) {
      // A Redis blip must not disable rate limiting entirely — fall back to the
      // in-memory limiter so abusive bursts are still blunted on this instance.
      console.error("[rate-limit] Upstash error, falling back to in-memory:", e);
      return inMemoryLimited(key, max, windowMs);
    }
  }
  return inMemoryLimited(key, max, windowMs);
}
