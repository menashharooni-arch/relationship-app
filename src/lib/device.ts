// ── One account, two devices ─────────────────────────────────────────────────
//
// WHAT COUNTS AS A DEVICE
//
// One browser profile, or one app install. The identity is a long-lived cookie
// (`sc_device`) planted by the proxy, so:
//
//   • every tab and every window of the same browser share it — opening five
//     tabs costs one slot, not five;
//   • the iOS shell's WebView has its own cookie jar, so the app is its own
//     device, exactly as it should be;
//   • two different browser APPS on one computer (Chrome and Safari) have
//     separate cookie jars and therefore count as two.
//
// That last point is a real limit and worth being straight about: nothing a
// cookie can do sees across two browsers, and the only technique that would is
// fingerprinting — reading canvas output, installed fonts, hardware details —
// which is unreliable, breaks under normal privacy settings, and is not
// something to build into an account-security feature. So the honest promise is
// "two browsers or apps", not "two pieces of hardware".
//
// WHY A COOKIE AND NOT localStorage
//
// The check runs in the proxy, before a protected page renders. The proxy is
// server-side and cannot read localStorage; a cookie is the only identifier it
// can see on the request. It is also set httpOnly, so page scripts — ours or an
// injected one — cannot read or forge it.
//
// PRIVACY: the cookie is planted ONLY on authenticated paths, never on the
// marketing site. It exists to manage sessions, not to follow anyone around.

/** The device identity cookie. httpOnly, SameSite=Lax, a year long. */
export const DEVICE_COOKIE = "sc_device";

/** How many devices one account may be signed in on at once. */
export const DEVICE_LIMIT = 2;

/** A year. Long enough that a real device is never asked to re-claim a slot. */
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Cryptographically random, URL-safe, and long enough not to collide. */
export function newDeviceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Is this a device id we planted? Anything else is treated as absent. */
export function isDeviceId(v: string | undefined | null): v is string {
  return typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
}

/**
 * A name a person will recognise in a list of their own devices.
 *
 * Deliberately coarse. This is shown so someone can tell "my phone" from "the
 * laptop at work" when freeing a slot; it is not device intelligence, and it is
 * derived from the User-Agent string the browser volunteers, nothing more.
 */
export function deviceLabel(userAgent: string | null | undefined, isNative = false): string {
  if (isNative) return "SwiftCard app";
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";

  const platform =
    /iPad/i.test(ua) ? "iPad"
    : /iPhone/i.test(ua) ? "iPhone"
    : /Android/i.test(ua) ? "Android"
    : /Macintosh|Mac OS X/i.test(ua) ? "Mac"
    : /Windows/i.test(ua) ? "Windows"
    : /Linux/i.test(ua) ? "Linux"
    : "Device";

  // Order matters: Edge and Opera both carry "Chrome", and Chrome carries
  // "Safari". Most specific first, or every browser on earth reads as Safari.
  const browser =
    /Edg\//i.test(ua) ? "Edge"
    : /OPR\/|Opera/i.test(ua) ? "Opera"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /CriOS\//i.test(ua) ? "Chrome"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Safari\//i.test(ua) ? "Safari"
    : null;

  return browser ? `${platform} · ${browser}` : platform;
}
