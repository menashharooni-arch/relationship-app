"use client";

// The ask to turn notifications on, at the top of the dashboard.
//
// WHY IT IS NOT NATIVE-ONLY ANY MORE. This started life as NativePushNudge,
// shown only inside the iPhone shell, on the reasoning that a new account
// already meets the push switch on the "Your card is live!" screen. That
// reasoning quietly excluded almost everybody: most people sign up on a laptop,
// see the switch once in the middle of building their first card — before they
// have any idea what a notification from SwiftCard would even say — and are
// never asked again. The push table shows the result plainly: two registered
// devices in the entire product. A notification system nobody receives is worth
// exactly nothing, so the ask now runs wherever it can actually succeed.
//
// AT MOST TWO ASKS, EVER. The first is on sight. The second only happens once
// the person's card has real views — the one moment the offer stops being an
// abstraction and starts being "there is something to tell you about". After
// that the banner is gone for good and Settings is the only way in. That
// ceiling is the point: a prompt that keeps coming back is the same disrespect
// as a notification that keeps coming back.

import { useEffect, useState } from "react";
import EnablePushButton, { usePushState } from "@/components/EnablePushButton";

// Stage of the ask this device has dismissed: "1" = the cold open, "2" = the
// second ask after real activity. Absent = never dismissed.
const DISMISSED_KEY = "sc_push_nudge_dismissed";

export default function PushNudge({ viewCount = 0 }: { viewCount?: number }) {
  const [state] = usePushState();
  // Starts at the terminal stage so nothing flashes before the read below —
  // the server has no idea what this device has dismissed.
  const [stage, setStage] = useState(2);

  useEffect(() => {
    let seen = 0;
    try { seen = Number(localStorage.getItem(DISMISSED_KEY) ?? 0) || 0; } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage
    setStage(seen);
  }, []);

  const hasActivity = viewCount > 0;

  function dismiss() {
    // Record which ask was turned down, so the activity ask still gets its turn
    // after the cold one — and nothing gets a third.
    const next = hasActivity ? 2 : 1;
    try { localStorage.setItem(DISMISSED_KEY, String(next)); } catch { /* ignore */ }
    setStage(next);
  }

  // "idle" is the only state worth a banner: the switch can be turned on right
  // here, in one tap. Already on, blocked at the OS level, an iPhone browser
  // tab that needs installing first, or a shell without the plugin — none of
  // those can be fixed by this box, and Settings carries the right message for
  // each of them.
  const asking = stage === 0 || (stage === 1 && hasActivity);
  if (!asking || state !== "idle") return null;

  return (
    <div
      className="rounded-2xl px-5 py-4 mb-5 border"
      style={{ background: "rgba(37,99,235,0.10)", borderColor: "rgba(37,99,235,0.35)" }}
    >
      <p className="text-sm font-semibold text-blue-100">
        {hasActivity ? "Your card is getting opened" : "Know the moment someone connects"}
      </p>
      <p className="text-xs text-blue-300/70 mt-1 leading-relaxed">
        {hasActivity
          // The real number, and only what it actually proves. "Opened N times"
          // is a fact; "N people" would not be — repeat opens by one visitor
          // count here too. The second ask is more persuasive than the first
          // precisely because it is true, and inflating it would poison the one
          // notification channel we have.
          ? `Your card has been opened ${viewCount === 1 ? "once" : `${viewCount} times`}. Get told as it happens, instead of finding out later.`
          : "Get an alert when someone opens your card or shares their details with you."}
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
