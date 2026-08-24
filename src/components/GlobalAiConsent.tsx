"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AiConsentGate from "@/components/AiConsentGate";
import { useIsNativeApp } from "@/lib/platform";
import type { AiConsent } from "@/lib/ai-consent";

type ConsentState = {
  consent: AiConsent;
  provider: string | null;
  copy: { title: string; what: string[]; who: string; control: string };
};

/**
 * Mounts the AI-consent ask GLOBALLY (root layout), so it appears on the first
 * signed-in native screen — whichever screen that is.
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
    if (state && !signedOut) return; // decision (or lack of one) already known
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

  return (
    <AiConsentGate
      consent={state.consent}
      provider={state.provider}
      copy={state.copy}
    />
  );
}
