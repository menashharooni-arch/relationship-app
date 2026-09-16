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
 */
export function popupConnectUrl(connectHref: string, returnTo: string): string {
  const url = new URL(connectHref, window.location.origin);
  const relay = `${LINKEDIN_RELAY_PATH}?to=${encodeURIComponent(returnTo)}`;
  url.searchParams.set("next", relay);
  return url.toString();
}
