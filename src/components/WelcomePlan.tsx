"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EnablePushButton from "@/components/EnablePushButton";
import PlanCards, { type PaidPlan } from "@/components/PlanCards";
import { consumePlanIntent, type PlanIntent } from "@/lib/plan-intent";
import { detectNativeApp } from "@/lib/platform";

// Onboarding step shown once, right after a brand-new account's first card is
// saved (routed here by GuestDraftClaim → /welcome?card=slug). It turns on
// notifications, then finalizes the plan the visitor picked BEFORE signing up:
// Free → dashboard + guided tour, Pro/Office → Stripe checkout (which returns to
// the same dashboard + tour). If they arrive without a stored choice, it shows
// the full plan chooser instead.

// Where checkout (and the Free choice) send the user: dashboard, welcome popup,
// and an auto-started guided tour — everything a new account should get.
const LANDING = "/dashboard?welcome=1&tour=1";

export default function WelcomePlan({ cardSlug, designConverted = false }: { cardSlug: string | null; designConverted?: boolean }) {
  const router = useRouter();
  // undefined = not read yet (avoids a hydration flash); null = no stored choice.
  const [intent, setIntent] = useState<PlanIntent | null | undefined>(undefined);
  const [loading, setLoading] = useState<"free" | PaidPlan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // NATIVE (App Store 3.1.1): never resume a stored paid-plan intent inside
    // the Capacitor shell — the "Complete your subscription" checkout panel is
    // a selling surface. Native always falls through to the plan step, where
    // PlanCards renders only the free continue action. Web unchanged.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time consume of stored intent on mount (reads+clears storage; must not run during render)
    setIntent(detectNativeApp() ? null : consumePlanIntent());
  }, []);

  function goFree() {
    setLoading("free");
    router.push(LANDING);
  }

  async function checkout(plan: PaidPlan, annual: boolean, seats: number) {
    setLoading(plan);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Unified {plan, interval, seats} — price resolves server-side.
          plan: plan === "office" ? "office" : "pro",
          interval: annual ? "annual" : "monthly",
          seats: plan === "office" ? seats : 1,
          ...(intent?.promo ? { promoCode: intent.promo } : {}),
          // Office owners go to the Office dashboard after payment; Pro keeps the
          // guided-tour landing. (The card was already created before payment in
          // this guest flow, so no post-payment card step is needed here.)
          successPath: plan === "office" ? "/office/admin" : LANDING + "&upgraded=true",
        }),
      });
      if (res.status === 401) { window.location.href = "/login?next=/welcome"; return; }
      const { url, error: err } = await res.json();
      if (url) { window.location.href = url; return; }
      setError(err || "Couldn't start checkout. Please try again.");
      setLoading(null);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setLoading(null);
    }
  }

  const paidIntent = intent && (intent.plan === "pro" || intent.plan === "office") ? intent : null;
  const planName = paidIntent?.plan === "office" ? "Office" : "Pro";

  return (
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-white font-bold text-2xl sm:text-3xl">Your card is live!</h1>
          {cardSlug && <p className="text-blue-400 text-sm mt-1.5 font-mono">swiftcard.me/card/{cardSlug}</p>}
          <p className="text-gray-400 text-sm mt-3 max-w-md mx-auto">One quick thing, then you&apos;re all set.</p>
        </div>

        {/* Notifications — always offered */}
        <div className="max-w-md mx-auto mb-10">
          <div className="rounded-2xl border border-blue-800/40 bg-blue-950/30 px-4 py-4 mb-3 text-center">
            <p className="text-blue-200 font-semibold text-sm">Turn on notifications</p>
            <p className="text-blue-300/80 text-xs mt-1.5 leading-relaxed">Get an instant alert the moment someone shares their info through your card.</p>
          </div>
          <EnablePushButton />
        </div>

        {/* Plan finalize / chooser */}
        {intent === undefined ? (
          <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" /></div>
        ) : paidIntent ? (
          // They picked a paid plan before signing up → complete payment.
          <div className="max-w-md mx-auto text-center">
            <h2 className="text-white font-bold text-xl">Complete your {planName} subscription</h2>
            <p className="text-gray-400 text-sm mt-1.5">You picked {planName}{paidIntent.annual ? " (billed annually)" : ""}{paidIntent.plan === "office" ? ` · ${paidIntent.seats ?? 2} seats` : ""}. Pay securely with Stripe to unlock it.</p>
            <button
              onClick={() => checkout(paidIntent.plan as PaidPlan, !!paidIntent.annual, paidIntent.seats ?? 2)}
              disabled={loading !== null}
              className="mt-5 w-full py-3.5 rounded-full text-sm font-bold text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--rd-aurora)" }}
            >
              {loading ? "Redirecting to checkout…" : `Continue to secure checkout →`}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
              {paidIntent.plan === "pro" ? "14 days free, then auto-renews. Cancel anytime. " : ""}
              By continuing you agree to our{" "}
              <a href="/terms" className="underline hover:text-gray-300">Terms</a> and{" "}
              <a href="/privacy" className="underline hover:text-gray-300">Privacy Policy</a>.
            </p>
            <button onClick={goFree} disabled={loading !== null} className="mt-3 text-gray-500 hover:text-gray-300 text-xs transition-colors">
              Actually, start on the free plan instead →
            </button>
          </div>
        ) : intent?.plan === "free" ? (
          // They picked Free before signing up → straight to the dashboard.
          <div className="max-w-md mx-auto text-center">
            <h2 className="text-white font-bold text-xl">You&apos;re on the Free plan</h2>
            <p className="text-gray-400 text-sm mt-1.5">Everything you need to start sharing and capturing leads — upgrade anytime.</p>
            {designConverted && (
              <p className="mt-4 rounded-xl border border-blue-800/40 bg-blue-950/30 px-4 py-3 text-left text-blue-200/90 text-xs leading-relaxed">
                Custom colors and premium design options are available on Pro. Your card content will be saved, but we&apos;ll apply a basic Free design that you can still customize.
              </p>
            )}
            <button onClick={goFree} disabled={loading !== null} className="mt-5 w-full py-3.5 rounded-full text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
              {loading === "free" ? "Setting up…" : "Go to your dashboard →"}
            </button>
          </div>
        ) : (
          // No stored choice (e.g. signed up another way) → show the chooser.
          <>
            <div className="text-center mb-6">
              <h2 className="text-white font-bold text-xl">Choose your plan</h2>
              <p className="text-gray-400 text-sm mt-1">Start free — upgrade anytime as your network grows.</p>
            </div>
            <PlanCards onFree={goFree} onPaid={checkout} busy={loading} />
          </>
        )}

        {error && <p className="text-red-400 text-sm text-center mt-5">{error}</p>}
      </div>
    </main>
  );
}
