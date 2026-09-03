"use client";

// First-open notifications ask, native shell only.
//
// The "Your card is live!" screens already offer the push switch, so a brand
// new account is asked at the right moment. Someone who signs in to an EXISTING
// account on the iPhone app never reached those screens and was never asked —
// they had to find Settings → Notifications & preferences on their own, and
// nobody does. This banner sits at the top of the dashboard until they either
// switch it on or tap "Not now".
//
// It's a banner with a tap, not a bare permission dialog on launch: iOS lets an
// app ask exactly once, so the ask needs the one line of context that makes
// people say yes.

import { useEffect, useState } from "react";
import EnablePushButton, { usePushState } from "@/components/EnablePushButton";
import { useIsNativeApp } from "@/lib/platform";

const DISMISSED_KEY = "sc_push_nudge_dismissed";

export default function NativePushNudge() {
  const native = useIsNativeApp();
  const [state] = usePushState();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(DISMISSED_KEY) === "1"; } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage
    setDismissed(seen);
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  // "idle" is the only state worth a banner: the switch can be turned on right
  // here. Already on, denied at the OS level, or a shell without the plugin —
  // nothing to ask, and the settings page carries the right message for each.
  if (!native || dismissed || state !== "idle") return null;

  return (
    <div
      className="rounded-2xl px-5 py-4 mb-5 border"
      style={{ background: "rgba(37,99,235,0.10)", borderColor: "rgba(37,99,235,0.35)" }}
    >
      <p className="text-sm font-semibold text-blue-100">Know the moment someone connects</p>
      <p className="text-xs text-blue-300/70 mt-1 leading-relaxed">
        Get an alert when someone views your card or shares their details with you.
      </p>
      <div className="mt-3">
        <EnablePushButton onDone={dismiss} />
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 text-xs font-medium text-blue-400/60 hover:text-blue-200"
      >
        Not now
      </button>
    </div>
  );
}
