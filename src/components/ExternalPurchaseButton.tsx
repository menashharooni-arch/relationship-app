"use client";

import { useEffect, useState } from "react";
import { canOfferExternalPurchase, openExternalPurchase } from "@/lib/external-purchase";

/**
 * The subscribe affordance shown inside the iOS shell, and nowhere else.
 *
 * This is the remedy for the Guideline 3.1.1 rejection of 1.0.0 (3): the app
 * gave paying customers access to content bought on the website with no way to
 * buy it from the app. On the US storefront Apple permits a link out to the
 * default browser instead of In-App Purchase, and that is what this is.
 *
 * Deliberately a <button>, not an <a>: an anchor to swiftcard.me would be
 * caught by capacitor.config.ts's allowNavigation and navigate inside the
 * webview, which is not "linking out to the default browser". The click goes
 * through the native plugin — see src/lib/external-purchase.ts.
 *
 * Renders nothing on web (the site already has its own checkout) and nothing in
 * a shell build without the native plugin, so it can never degrade into an
 * in-app purchase path that only looks compliant.
 */
export default function ExternalPurchaseButton({
  label = "Subscribe on swiftcard.me",
  path,
  className = "",
}: {
  label?: string;
  /** Destination on the site. Defaults to the upgrade page. */
  path?: string;
  className?: string;
}) {
  // Resolved after mount: detectNativeApp() reads window, and the plugin is
  // injected by the bridge, so neither is knowable during SSR or first paint.
  const [available, setAvailable] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability probe, only knowable on the client
    setAvailable(canOfferExternalPurchase());
  }, []);

  if (!available) return null;

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const opened = await openExternalPurchase(path);
          if (!opened) setFailed(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-500 ${className}`}
      >
        {label}
        {/* Arrow-out-of-box: says "this leaves the app" before the tap, which
            is both honest and what Apple expects a link-out to look like. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18v4.5M17.5 6.5L10 14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
        </svg>
      </button>
      {failed && (
        <p role="alert" className="mt-1.5 text-[12px] text-amber-400">
          Couldn&apos;t open Safari. You can subscribe at swiftcard.me.
        </p>
      )}
    </>
  );
}
