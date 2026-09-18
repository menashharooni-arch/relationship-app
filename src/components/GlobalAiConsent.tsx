"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AiConsentGate from "@/components/AiConsentGate";
import { useIsNativeApp } from "@/lib/platform";
import { aiConsentAskAllowedOn, type AiConsent } from "@/lib/ai-consent";

type ConsentState = {
  consent: AiConsent;
  /** The account has finished Get Started (card + plan) — see aiConsentAskReady. */
  ready?: boolean;
  provider: string | null;
  copy: { title: string; what: string[]; who: string; control: string };
};

/**
 * Mounts the AI-consent ask GLOBALLY (root layout), so it appears on the first
 * signed-in native screen INSIDE THE APP — whichever screen that is.
 *
 * Not during Get Started (owner, 2026-09-18). "The first signed-in screen" used
 * to be the dashboard; once the app's Create Account became build a card →
 * create the account → choose a plan, it became the plan step, and the dialog
 * landed in the middle of onboarding. It now waits for both halves of the rule
 * in lib/ai-consent: the screen is not a setup step (aiConsentAskAllowedOn) and
 * the account has a live card with its plan chosen (`ready`). Until then the
 * server keeps blocking AI requests from the app, so nothing is sent unasked.
 *
 * Why global: the gate used to be mounted per-page, on /dashboard and
 * /contacts only, while AI features are reachable from far more places (the
 * help bubble is on every app page, the design scanner lives on /cards/new and
 * the editor). Any path that reached one of those before crossing a page with
 * the gate shared data with the provider having asked nothing — which is the
 * exact sentence in the 5.1.1(i)/5.1.2(i) rejection, three rounds running.
 * Server-side, aiConsentPermits now blocks those requests anyway (unset blocks
 * in the app); this mount is what asks the question, so features work instead
 * of 403ing.
 *
 * Web cost: none. The component renders nothing and fetches nothing unless the
 * shell bridge is present, so the website gains no UI and no traffic.
 *
 * The pathname effect re-checks after a 401: the layout persists across the
 * login transition, so a fetch made on /login (signed out) must be retried
 * once the user is in — otherwise the ask would wait for the next cold launch.
 */
export default function GlobalAiConsent() {
  const native = useIsNativeApp();
  const pathname = usePathname();
  const [state, setState] = useState<ConsentState | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    if (!native) return;
    // Signed-out surfaces: no session to ask about. Skipping avoids a 401 in
    // the console on every sign-in screen (the pathname dependency re-runs
    // this the moment they land on a signed-in route).
    // Setup steps too: nothing is asked there, so there is nothing to fetch.
    if (!aiConsentAskAllowedOn(pathname)) return;
    // Decision (or lack of one) already known. A not-yet-ready answer is NOT
    // final — it is re-read on the next screen, which is how the ask appears
    // on the dashboard right after "Your card is live!" without a cold launch.
    if (state && !signedOut && state.ready !== false) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/ai-consent");
        if (cancelled) return;
        if (res.status === 401) {
          setSignedOut(true);
          return;
        }
        if (!res.ok) return;
        setSignedOut(false);
        setState(await res.json());
      } catch {
        /* transient — the server-side guard holds regardless */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname is the retry trigger after a 401, not data
  }, [native, pathname]);

  if (!native || !state) return null;

  // HELD, not unmounted, on a setup step: the gate remembers "already answered
  // this launch" in its own state, and unmounting it every time someone opens
  // /cards/new or /upgrade would re-ask a person who said no the moment they
  // came back. `ready !== false`: a response without the field (an older
  // deployment answering during a rollout) keeps the old behaviour rather than
  // hiding the ask for good.
  const hold = state.ready === false || !aiConsentAskAllowedOn(pathname);

  return (
    <AiConsentGate
      consent={state.consent}
      provider={state.provider}
      copy={state.copy}
      hold={hold}
    />
  );
}
