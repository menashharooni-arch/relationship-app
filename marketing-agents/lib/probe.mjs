// ── Shared HTTP probe for every code-only watchdog ──────────────────────────
// Lives in its own module so lib/detectors.mjs (Rex's original four) and
// lib/detectors-servicing.mjs (the nine added 2026-09-08) share ONE timeout
// and ONE retry policy. A probe never throws: an outage is a return value.

export const BASE = process.env.HEALTH_BASE_URL || "https://swiftcard.me";

/** Fetch with a hard timeout; never throws. Returns {ok,status,ms,body,headers}. */
export async function probe(path, { method = "GET", timeoutMs = 15000, wantBody = false, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const url = /^https?:/.test(path) ? path : BASE + path;
    const res = await fetch(url, { method, signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "SwiftCard-Watchdog/1.0 (+https://swiftcard.me)", ...headers } });
    const body = wantBody ? await res.text() : "";
    return { ok: res.ok, status: res.status, ms: Date.now() - t0, body, headers: res.headers, url: res.url };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, body: "", headers: new Headers(), url: "", err: String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Transient blips are not incidents. Three tries before a probe counts as failed. */
export async function stable(fn, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    last = await fn();
    if (last.ok) return last;
    if (i < tries) await new Promise((r) => setTimeout(r, 2000 * i));
  }
  return last;
}

/**
 * Supabase REST read that returns null instead of throwing, so a detector can
 * tell "table unreachable" (→ blindness) from "no rows" (→ all clear).
 */
export async function sbRows(table, params) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${table}?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Exact row count via the count header; null when the table cannot be read. */
export async function sbCount(table, params = "") {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1${params ? `&${params}` : ""}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
    });
    if (!res.ok && res.status !== 206) return null;
    const total = (res.headers.get("content-range") ?? "/").split("/")[1];
    return total === "*" || total === "" ? null : Number(total);
  } catch {
    return null;
  }
}

export const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
