import { safeNextPath } from "@/lib/safe-next";

// ── Where an emailed auth link was meant to take the person ──────────────────
// The SwiftCard auth email templates end every link with
// `&redirect_to={{ .RedirectTo }}` — the emailRedirectTo the app passed to
// Supabase, e.g. https://swiftcard.me/auth/callback?next=%2Fcards%2Fnew%3Fplan%3Doffice%26seats%3D5.
// That inner `next` is what matters; this recovers it.
//
// It is read from the RAW query string, and redirect_to is always the LAST
// parameter in the templates, for one reason: whether Supabase percent-encodes
// {{ .RedirectTo }} when it fills the template is not something to bet a
// sign-up on. Encoded, the tail is "https%3A%2F%2F…" and decodes once into the
// original URL. Not encoded, the tail already IS the original URL — and parsing
// it as an ordinary query value would decode it once too many, turning the
// inner %26 into & and cutting `next` off at "/cards/new?plan=office". Both
// shapes are handled; anything else gives null and the caller's default.
//
// Only SwiftCard's own host is honoured: this is an open-redirect surface
// otherwise. The result is a same-origin PATH, run through safeNextPath.

const OWN_HOSTS = new Set(["swiftcard.me", "www.swiftcard.me"]);

export function nextFromConfirmUrl(url: URL): string | null {
  const direct = url.searchParams.get("next");
  if (direct) return safeNextPath(direct);

  const raw = url.search;
  const at = raw.indexOf("redirect_to=");
  if (at === -1) return null;
  let tail = raw.slice(at + "redirect_to=".length);
  if (/^https?%3A/i.test(tail)) {
    try { tail = decodeURIComponent(tail); } catch { return null; }
  }
  let target: URL;
  try { target = new URL(tail); } catch { return null; }
  if (!OWN_HOSTS.has(target.hostname) && target.host !== url.host) return null;

  // /auth/callback?next=… (sign-up, invite sign-in): the next it carries —
  // read as RAW text, everything after "next=". The app only ever puts `next`
  // on these (plus `intent` on an OAuth one, stripped below). Raw because by
  // now the inner `next` may have lost its own layer of encoding: Next.js
  // re-serialises a request's query before the route sees it, which turned
  // …%26seats%3D5 into …&seats=5 and cut "/cards/new?plan=office&seats=5"
  // down to "/cards/new?plan=office" (measured on a production build). Still
  // encoded ("%2F…") → decode once; already decoded ("/…") → use as is.
  if (target.pathname === "/auth/callback" || target.pathname === "/auth/confirm") {
    const m = /(?:^|&)next=(.*)$/.exec(target.search.replace(/^\?/, ""));
    if (!m) return null;
    let value = m[1].replace(/&intent=(?:signin|signup)$/, "");
    if (/^%2F/i.test(value)) {
      try { value = decodeURIComponent(value); } catch { return null; }
    }
    return safeNextPath(value);
  }
  // Supabase falls back to the bare Site URL when a redirect isn't allowed.
  if (target.pathname === "/" && !target.search) return null;
  return safeNextPath(target.pathname + target.search);
}
