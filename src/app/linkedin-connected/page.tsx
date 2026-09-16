"use client";

import { useEffect, useState } from "react";
import { isLinkedInPopup, LINKEDIN_MESSAGE } from "@/lib/linkedin-popup";
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

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const status = sp.get("status");
    // `to` is attacker-controllable like any ?next= — same guard, same reason.
    const back = safeNextPath(sp.get("to")) ?? "/profile";

    if (isLinkedInPopup()) {
      try {
        window.opener!.postMessage({ source: LINKEDIN_MESSAGE, status }, window.location.origin);
      } catch {
        // Opener gone (user closed the editor mid-consent). Nothing to tell.
      }
      window.close();
      // A window the script did not open cannot always close itself; if we are
      // still here a moment later, offer the way back rather than a dead page.
      const t = setTimeout(() => setStuck(true), 600);
      return () => clearTimeout(t);
    }

    // No opener: the popup was blocked and the hop ran as a normal navigation,
    // or someone reached this URL directly. Carry the status on to the page the
    // user started from, which knows how to finish the import.
    const url = new URL(back, window.location.origin);
    url.searchParams.set("integration", "linkedin");
    if (status) url.searchParams.set("status", status);
    window.location.replace(url.toString());
  }, []);

  return (
    <main className="sc-app min-h-screen bg-gray-950 grid place-items-center px-6">
      <div className="text-center">
        <p className="text-gray-300 text-sm">Finishing up with LinkedIn…</p>
        {stuck && (
          <p className="text-gray-500 text-xs mt-3">
            You can close this window and return to SwiftCard.
          </p>
        )}
      </div>
    </main>
  );
}
