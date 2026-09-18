"use client";

import { useEffect } from "react";
import EnablePushButton, { usePushState } from "@/components/EnablePushButton";
import { detectNativeApp } from "@/lib/platform";
import { pushAskCopy } from "@/lib/push-ask";
import {
  askDecision, askEnabledFor, askPushOn, askSnoozed, askStopped, claimAsk, confirmEnabledFromAsk, laterAsk, stopAsk,
  useAskSlot, useAskStore, type AskSurface,
} from "@/lib/push-ask-client";

// ── "Get notifications like this on your phone" ─────────────────────────────
//
// The reminder under ONE important notification — a new contact, a reply, a
// contact download — for someone whose device could turn push on right now and
// hasn't. Every rule about when (at most twice per account, days apart, never
// once they said no) is in lib/push-ask.ts and applied by /api/push/ask; which
// surface may show it (never two at once) is lib/push-ask-client.ts.

export type PushAsk = { show: boolean; confirming: boolean; id: string | null };

/**
 * Whether the reminder shows on `candidateId` in `surface`.
 *
 * `visible` is whether the surface is actually on screen — the bell passes
 * whether its dropdown is open, because a reminder is counted when it is SHOWN
 * and a closed dropdown shows nothing.
 */
export function usePushAsk(surface: AskSurface, candidateId: string | null, visible: boolean): PushAsk {
  // THIS device can switch push on in one tap, here. Blocked by the OS, an
  // iPhone browser tab that has to be installed first, an app build without
  // the plugin, or push already on — none of those is fixed by this reminder,
  // and Settings carries the right words for each.
  const [state] = usePushState();
  useAskStore();

  const confirming = !!candidateId && askEnabledFor() === candidateId;
  const decision = candidateId ? askDecision(candidateId) : undefined;
  const askable = state === "idle" && !askStopped() && !askPushOn() && !askSnoozed() && decision !== false;
  const mine = useAskSlot(surface, visible && !!candidateId && (confirming || askable));

  useEffect(() => {
    if (mine && candidateId && !confirming) void claimAsk(candidateId);
  }, [mine, candidateId, confirming]);

  return {
    show: mine && !!candidateId && (confirming || (askable && decision === true)),
    confirming,
    id: candidateId,
  };
}

export default function PushAskCallout({ ask, tone = "bell" }: { ask: PushAsk; tone?: "bell" | "panel" }) {
  if (!ask.show || !ask.id) return null;
  const id = ask.id;
  // Only ever rendered on the client (it needs the device's push state), so
  // reading the device here cannot disagree with the server's HTML.
  const onPhone = detectNativeApp() || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const copy = pushAskCopy(onPhone);

  return (
    // Inset to the text column of the row above it (dot + gap), same colour as
    // an unread row, so it reads as part of that notification.
    <div role="group" aria-label="Turn on push notifications" data-push-ask="" className={`${tone === "panel" ? "bg-blue-950/40" : "bg-blue-950"} pl-9 pr-4 pt-1 pb-3.5`}>
      {ask.confirming ? (
        <p className="text-xs font-semibold text-emerald-400" role="status">
          You&apos;re set — notifications like this will reach your {onPhone ? "phone" : "computer"} now.
        </p>
      ) : (
        <>
          <p className="text-white text-xs font-semibold">{copy.title}</p>
          <p className="text-gray-400 text-[0.6875rem] mt-0.5 leading-relaxed">{copy.sub}</p>
          <div className="mt-2.5">
            {/* A "Don't Allow" at the device's own prompt ends every reminder
                on every device — EnablePushButton records that itself. */}
            <EnablePushButton onDone={() => confirmEnabledFromAsk(id)} />
          </div>
          <div className="mt-2 flex items-center gap-4">
            <button type="button" onClick={() => laterAsk(id)} className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
              Not now
            </button>
            <button type="button" onClick={stopAsk} className="text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors">
              Don&apos;t ask again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
