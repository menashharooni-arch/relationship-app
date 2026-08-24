"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  canOfferIap,
  ensureIapConfigured,
  getIapPackages,
  purchaseIap,
  restoreIap,
  type IapPackage,
} from "@/lib/iap";

/**
 * The In-App Purchase paywall, iOS shell only.
 *
 * This replaced ExternalPurchaseButton as PlanNotice's purchase path after the
 * 1.0.0 (7) rejection: App Review requires the Pro subscription to be
 * purchasable via IAP (3.1.1 / 3.1.3(b)); the US link-out defense was made and
 * did not survive contact with a reviewer.
 *
 * Review-compliance invariants, each one a past or telegraphed rejection:
 *   • Prices come ONLY from StoreKit (pkg.priceString). Nothing here may
 *     hardcode a dollar amount — App Store price and shown price must be the
 *     same number by construction (3.1.2 metadata truthfulness).
 *   • Restore Purchases is always present alongside the buy buttons (3.1.2).
 *   • Terms of Use + Privacy Policy links are always present (3.1.2 / EULA
 *     requirement for auto-renewable subscriptions).
 *   • The auto-renewal disclosure sentence is always visible, not tucked
 *     behind a disclosure toggle.
 *   • No mention of the website, web pricing, or "cheaper elsewhere" — the
 *     external-purchase link is deliberately absent from this build to keep
 *     one clean purchase story in review.
 *
 * Fail-closed: if StoreKit products cannot be loaded (no plugin, no key, no
 * network, ASC products not yet approved) the subscribe button renders
 * nothing. A paywall with no live products would be a lie in a modal.
 */
export default function IapSubscribeButton({ className = "" }: { className?: string }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await canOfferIap())) return;
      // The RevenueCat identity must be the Supabase uid BEFORE any purchase —
      // it is how the webhook maps the sub to a profile. Resolved here rather
      // than prop-drilled through every PlanGate call site.
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // signed-out surfaces never sell
      const ok = await ensureIapConfigured(user.id);
      if (!cancelled) setAvailable(ok);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!available) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full rounded-full bg-blue-600 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500 ${className}`}
      >
        Subscribe to Pro
      </button>
      {open && <PaywallSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function PaywallSheet({ onClose }: { onClose: () => void }) {
  const [packages, setPackages] = useState<IapPackage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pkgs = await getIapPackages();
      if (cancelled) return;
      setPackages(pkgs);
      // Annual pre-selected: better deal for the user, better retention for us.
      setSelected(pkgs.find((p) => p.period === "annual")?.identifier ?? pkgs[0]?.identifier ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  async function buy() {
    if (!selected || busy) return;
    setBusy("purchase");
    setNotice("");
    const result = await purchaseIap(selected);
    setBusy(null);
    if (result === "purchased") {
      // Plan-gated UI across the app re-reads the profile on load; a reload is
      // the honest way to reflect the new entitlement everywhere at once.
      window.location.reload();
      return;
    }
    if (result === "failed") setNotice("The purchase didn't go through. You have not been charged beyond any existing subscription.");
  }

  async function restore() {
    if (busy) return;
    setBusy("restore");
    setNotice("");
    const restored = await restoreIap();
    setBusy(null);
    if (restored) {
      window.location.reload();
      return;
    }
    setNotice("No previous purchase was found for this Apple account.");
  }

  const hasProducts = (packages?.length ?? 0) > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="iap-paywall-title"
      className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
        <p id="iap-paywall-title" className="text-center text-base font-bold text-white">
          SwiftCard Pro
        </p>
        <p className="mt-1 text-center text-[13px] text-gray-400">
          Everything, unlimited — cards, contacts, AI drafts, the scanner and the custom designer.
        </p>

        {packages === null && (
          <p className="mt-5 text-center text-[13px] text-gray-500">Loading plans…</p>
        )}

        {packages !== null && !hasProducts && (
          <p className="mt-5 text-center text-[13px] text-gray-500">
            Plans aren&apos;t available right now. Please try again later.
          </p>
        )}

        {hasProducts && (
          <>
            <div className="mt-5 flex flex-col gap-2">
              {packages!.map((pkg) => (
                <button
                  key={pkg.identifier}
                  type="button"
                  onClick={() => setSelected(pkg.identifier)}
                  aria-pressed={selected === pkg.identifier}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                    selected === pkg.identifier
                      ? "border-blue-500 bg-blue-600/15"
                      : "border-gray-800 bg-gray-900 hover:border-gray-700"
                  }`}
                >
                  <span className="text-sm font-semibold text-white">
                    {pkg.period === "annual" ? "Annual" : "Monthly"}
                  </span>
                  <span className="text-sm text-gray-300">
                    {pkg.priceString}
                    <span className="text-gray-500"> / {pkg.period === "annual" ? "year" : "month"}</span>
                  </span>
                </button>
              ))}
            </div>

            {packages!.some((p) => p.introPriceString === "free trial") && (
              <p className="mt-3 text-center text-[13px] font-semibold text-gray-300">
                Starts with 14 days free.
              </p>
            )}

            <button
              type="button"
              onClick={buy}
              disabled={busy !== null || !selected}
              className="mt-4 w-full rounded-full bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {busy === "purchase" ? "Purchasing…" : "Subscribe"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={restore}
          disabled={busy !== null}
          className="mt-2 w-full rounded-full py-2.5 text-[13px] font-semibold text-gray-400 transition-colors hover:text-white disabled:opacity-60"
        >
          {busy === "restore" ? "Restoring…" : "Restore Purchases"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy !== null}
          className="w-full rounded-full py-2 text-[13px] text-gray-500 transition-colors hover:text-gray-300 disabled:opacity-60"
        >
          Not now
        </button>

        {notice && <p className="mt-2 text-center text-xs text-red-400">{notice}</p>}

        {/* Auto-renewal disclosure + legal links: required for auto-renewable
            subscriptions, and kept visible rather than collapsed. */}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-500">
          Subscriptions renew automatically unless canceled at least 24 hours
          before the end of the current period. Manage or cancel anytime in your
          App Store account settings.
        </p>
        <p className="mt-1.5 text-center text-[11px] text-gray-500">
          <a href="/terms" className="underline">Terms of Use</a>
          <span className="mx-1.5">·</span>
          <a href="/privacy" className="underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
