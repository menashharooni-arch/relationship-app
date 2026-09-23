// ── The LinkedIn photo-import round trip, on the WEB ─────────────────────────
//
// Importing a LinkedIn photo is an OAuth consent hop: we have to leave the page
// and come back with a code. Doing that as a full-page navigation cost the user
// everything they had typed — you tap "Connect LinkedIn" from the card editor
// with an unsaved title, and the editor is torn down and rebuilt from the
// database. (Verified 2026-09-15: the edit was gone on return.)
//
// So on the web the consent hop runs in a POPUP instead. The editor never
// unloads, every unsaved field is exactly where it was, and the popup hands the
// result back through postMessage. That also fixes a second bug for free: the
// callback used to land back on /cards/<id>/edit, which always opens on the
// "content" tab, so ProfilePhotoSuggest — which lives on the "design" tab —
// never mounted and the import never ran at all. The opener already has it
// mounted, because the user just clicked its button.
//
// The iOS shell does NOT use any of this: it runs the hop in an
// @capacitor/browser sheet (ASWebAuthenticationSession), which is what RFC 8252
// asks for and already keeps the page alive underneath. Deep-linking the
// consent screen into the LinkedIn app is not an option — the app has no way to
// return an authorization code to our redirect_uri, so no photo would ever come
// back.

/** Same-origin page the popup lands on; it relays and closes. */
export const LINKEDIN_RELAY_PATH = "/linkedin-connected";

/** Marks our postMessage so a stray message from anything else is ignored. */
export const LINKEDIN_MESSAGE = "swiftcard:linkedin-connected";

export type LinkedInRelayMessage = {
  source: typeof LINKEDIN_MESSAGE;
  /** The callback's own status: "connected" | "error" | "photo" | null. */
  status: string | null;
};

/** True when this document is the OAuth popup we opened (not the opener). */
export function isLinkedInPopup(): boolean {
  try {
    return typeof window !== "undefined" && !!window.opener && window.opener !== window;
  } catch {
    // Cross-origin opener access can throw; treat it as "not our popup".
    return false;
  }
}

/**
 * Build the connect URL for the popup: the callback returns to the relay page
 * rather than to the editor, so the editor is never reloaded. `returnTo` rides
 * along so the relay can still land somewhere sensible if there is no opener.
 * `nonce` ties the result to the ONE page that asked for it (see below).
 */
export function popupConnectUrl(connectHref: string, returnTo: string, nonce?: string): string {
  const url = new URL(connectHref, window.location.origin);
  const relay = `${LINKEDIN_RELAY_PATH}?to=${encodeURIComponent(returnTo)}${nonce ? `&n=${encodeURIComponent(nonce)}` : ""}`;
  url.searchParams.set("next", relay);
  return url.toString();
}

// ── Why the popup cannot rely on window.opener ───────────────────────────────
//
// LinkedIn's sign-in page is served with
//   Cross-Origin-Opener-Policy: same-origin-allow-popups
// Loading it in our popup puts the popup in a new browsing-context group, and
// the browser severs window.opener for good — it stays null after LinkedIn
// sends the popup back to swiftcard.me. The relay then saw "no opener" and
// loaded the editor INSIDE the popup (a new tab on a phone), starting from the
// top with no photo: "it brings me back to the front page" (owner, 2026-09-23).
// Only someone who had to SIGN IN to LinkedIn hit it; an already-signed-in
// LinkedIn session skips that page, which is why it looked intermittent.
//
// Same-origin storage is not affected by COOP. So the relay also leaves the
// result in localStorage under the page's nonce, and the page that opened the
// popup picks it up — through the `storage` event, or when its tab is focused
// again (an iPhone suspends the background tab, so the event alone can be
// missed). The popup never navigates to the editor itself any more.

// ── A guest's failed import, carried to the suggester ───────────────────────
// A signed-out visitor's LinkedIn hop is a full-page one and returns with
// ?integration=linkedin&status=…. On success the photo rides as ?li_photo= and
// is applied; on "error" / "nophoto" nothing was applied and nothing was SAID —
// the builder simply reopened, which reads as the button having done nothing.
// The homepage builders strip those params when they reopen, before the
// suggester is on screen, so they hand the status over here.
export const LINKEDIN_GUEST_STATUS_KEY = "sc_li_guest_status";

export function stashGuestLinkedInStatus(status: string | null): void {
  if (!status || status === "photo") return;
  try { sessionStorage.setItem(LINKEDIN_GUEST_STATUS_KEY, status); } catch { /* storage blocked */ }
}

export function takeGuestLinkedInStatus(): string | null {
  try {
    const s = sessionStorage.getItem(LINKEDIN_GUEST_STATUS_KEY);
    if (s) sessionStorage.removeItem(LINKEDIN_GUEST_STATUS_KEY);
    return s;
  } catch {
    return null;
  }
}

/** localStorage key the relay leaves the result under. */
export const LINKEDIN_RESULT_KEY = "sc_linkedin_result";

export type LinkedInResult = { n: string; status: string | null; at: number };

/** A fresh nonce for one connect attempt. */
export function newLinkedInNonce(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

/** The relay's half: leave the result where the opener will find it. */
export function leaveLinkedInResult(nonce: string, status: string | null): void {
  try {
    const value: LinkedInResult = { n: nonce, status, at: Date.now() };
    localStorage.setItem(LINKEDIN_RESULT_KEY, JSON.stringify(value));
  } catch { /* storage blocked — the postMessage path and the fallback link remain */ }
}

/**
 * The opener's half: the result for THIS nonce, if the relay has left it, and
 * removed so it is handled once. Results older than 15 minutes are ignored.
 */
export function takeLinkedInResult(nonce: string, raw?: string | null): LinkedInResult | null {
  try {
    const text = raw !== undefined ? raw : localStorage.getItem(LINKEDIN_RESULT_KEY);
    if (!text) return null;
    const r = JSON.parse(text) as LinkedInResult;
    if (!r || r.n !== nonce || Date.now() - r.at > 15 * 60 * 1000) return null;
    localStorage.removeItem(LINKEDIN_RESULT_KEY);
    return r;
  } catch {
    return null;
  }
}
