import { lookup } from "node:dns/promises";
import net from "node:net";

// ── SSRF-safe outbound fetch ────────────────────────────────────────────────
// Two public endpoints fetch attacker-supplied URLs (img-proxy, link-preview).
// A hostname-only blocklist is NOT enough: (a) DNS can resolve a public-looking
// host to a private IP (DNS rebinding), and (b) redirect:"follow" lets a public
// URL 30x-hop to http://169.254.169.254/ or http://127.0.0.1/. This module
// resolves every hostname to its IPs, rejects private/loopback/link-local
// ranges, and re-checks on EVERY redirect hop (manual redirects).

const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64/10 CGNAT
  /^192\.0\.0\./, /^192\.0\.2\./, /^198\.1[89]\./, /^198\.51\.100\./, /^203\.0\.113\./,
  /^22[4-9]\./, /^23\d\./, /^24\d\./, /^25\d\./, // multicast + reserved 224-255
];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((re) => re.test(ip));
  if (net.isIPv6(ip)) {
    const h = ip.toLowerCase();
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true; // link-local + ULA
    // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded v4.
    const m = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return PRIVATE_V4.some((re) => re.test(m[1]));
    return false;
  }
  return true; // unparseable → treat as unsafe
}

function badHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return (
    h === "localhost" || h.endsWith(".localhost") ||
    h.endsWith(".internal") || h.endsWith(".local") ||
    h === "metadata.google.internal"
  );
}

/** Throws if the URL's host is unsafe to fetch (bad scheme / name / resolved IP). */
export async function assertSafeUrl(u: URL): Promise<void> {
  if (!/^https?:$/.test(u.protocol)) throw new Error("blocked scheme");
  if (badHostname(u.hostname)) throw new Error("blocked host");
  // A literal IP in the URL never hits DNS — check it directly.
  const bare = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(bare)) {
    if (isPrivateIp(bare)) throw new Error("blocked ip");
    return;
  }
  // Resolve the name and reject if ANY answer is private (rebinding defense).
  const results = await lookup(u.hostname, { all: true });
  if (!results.length) throw new Error("dns fail");
  for (const { address } of results) if (isPrivateIp(address)) throw new Error("blocked ip");
}

/** True only for a real Zapier catch-hook URL (https + hooks.zapier.com).
 * Zapier webhooks are always on this host, so allowlisting it removes the
 * SSRF / internal-port-scan surface of an arbitrary user-supplied webhook. */
export function isZapierWebhookUrl(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && (u.hostname === "hooks.zapier.com" || u.hostname.endsWith(".hooks.zapier.com"));
  } catch { return false; }
}

/**
 * fetch() that revalidates the target before the initial request and on every
 * redirect hop. Caps redirects. Same signature surface as fetch for the fields
 * these callers use (signal, headers).
 */
export async function safeFetch(
  input: string,
  init: { signal?: AbortSignal; headers?: Record<string, string> } = {},
  maxRedirects = 4,
): Promise<Response> {
  let url = new URL(input);
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeUrl(url);
    const res = await fetch(url.toString(), { ...init, redirect: "manual" });
    // Manual mode surfaces 3xx as opaqueredirect/type — read Location ourselves.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      url = new URL(loc, url); // resolve relative redirects
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}
