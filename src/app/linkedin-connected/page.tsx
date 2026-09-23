"use client";

import { useEffect, useState } from "react";
import { isLinkedInPopup, leaveLinkedInResult, LINKEDIN_MESSAGE } from "@/lib/linkedin-popup";
import { safeNextPath } from "@/lib/safe-next";

// Where the LinkedIn consent popup lands. It does no work of its own: it hands
// the callback's status to the page that opened it and closes. The import runs
// in the opener, where the user's unsaved card edits still are — see
// lib/linkedin-popup.ts for why the round trip is shaped this way.
//
// Nothing here is reachable by a normal navigation in the happy path, so it
// stays deliberately plain: a line of text, and a way out if the window cannot
// close itself.
export default function LinkedInConnectedPage() {
  const [stuck, setStuck] = useState(false);
  const [hereHref, setHereHref] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const status = sp.get("status");
    const back = safeNextPath(sp.get("to")) ?? "/profile";
    const nonce = sp.get("n");

    const backUrl = new URL(back, window.location.origin);
    backUrl.searchParams.set("integration", "linkedin");
    if (status) backUrl.searchParams.set("status", status);

    // THE POPUP (the `n` nonce is only ever put on a popup's relay URL).
    //
    // LinkedIn's sign-in page cuts window.opener (COOP — lib/linkedin-popup),
    // so this used to find no opener and load the editor right here, in the
    // popup: a second copy of the page, from the top, with no photo. Now the
    // result is left in same-origin storage for the page that is still open,
    // and this window only ever closes. It never becomes the editor.
    if (nonce) {
      leaveLinkedInResult(nonce, status);
      try {
        // The direct line too, when the browser kept it (already signed in to
        // LinkedIn, so the COOP page was never shown).
        window.opener?.postMessage({ source: LINKEDIN_MESSAGE, status, n: nonce }, window.location.origin);
      } catch { /* severed — storage carries it */ }
      window.close();
      const t = setTimeout(() => {
        // Still here: the browser would not let a script close it (some do
        // not, once COOP has swapped the window). Say where to go instead of
        // doing something surprising, and offer the page here as a last resort.
        setFailed(status === "error");
        setHereHref(backUrl.pathname + backUrl.search);
        setStuck(true);
      }, 600);
      return () => clearTimeout(t);
    }

    // An older popup (opened before the nonce existed) with its opener intact.
    if (isLinkedInPopup()) {
      try {
        window.opener!.postMessage({ source: LINKEDIN_MESSAGE, status }, window.location.origin);
      } catch {
        // Opener gone or navigated cross-origin — the fallback below handles it.
      }
      window.close();
      // Some browsers refuse window.close() on a window they consider
      // user-opened; tell the user rather than leaving a blank page.
      const t = setTimeout(() => setStuck(true), 600);
      return () => clearTimeout(t);
    }

    // No popup at all (a full-page hop, e.g. popups blocked): go back to where
    // the user started, carrying the status the importer reads on mount.
    window.location.replace(backUrl.toString());
  }, []);

  return (
    <main className="sc-app min-h-screen bg-gray-950 grid place-items-center px-6">
      <div className="text-center max-w-xs">
        {!stuck ? (
          <p className="text-gray-300 text-sm">Finishing up with LinkedIn…</p>
        ) : (
          <>
            <p className="text-white text-sm font-semibold">
              {failed ? "LinkedIn didn't finish connecting" : "LinkedIn is connected"}
            </p>
            <p className="text-gray-400 text-xs mt-2 leading-relaxed">
              {failed
                ? "Close this window and go back to SwiftCard to try again."
                : "Close this window and go back to SwiftCard — your photo is being added there."}
            </p>
            {hereHref && (
              <a href={hereHref} className="inline-block mt-4 text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2">
                Open SwiftCard here instead
              </a>
            )}
          </>
        )}
      </div>
    </main>
  );
}
