"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EnablePushButton from "@/components/EnablePushButton";
import { GetTheAppCard } from "@/components/AppStoreBadge";
import PlanCards, { type PaidPlan } from "@/components/PlanCards";
import FreeDesignChoice from "@/components/FreeDesignChoice";
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

export default function WelcomePlan({
  cardSlug,
  designConverted = false,
  // What Free will change about the card they just built, in plain English,
  // computed server-side in welcome/page.tsx from the saved row (never from
  // React state, which is a tick behind). Empty for a card that uses nothing
  // Pro — and an empty list is the whole reason `chooseFree` has a fast path.
  proDesignChanges = [],
  presetIntent = null,
  setupFor = null,
}: {
  /** Back from Stripe with the plan already paid: open straight on the
   *  "card is live" setup step, then continue to this plan's home. */
  setupFor?: "pro" | "office" | null;
  cardSlug: string | null;
  /** A paid plan picked on /pricing, carried in the URL through signup. */
  presetIntent?: PlanIntent | null;
  designConverted?: boolean;
  proDesignChanges?: string[];
}) {
  const router = useRouter();
  // undefined = not read yet (avoids a hydration flash); null = no stored choice.
  const [intent, setIntent] = useState<PlanIntent | null | undefined>(undefined);
  const [loading, setLoading] = useState<"free" | PaidPlan | null>(null);
  const [error, setError] = useState("");
  // Asked only when there is something to lose; see chooseFree.
  const [pendingFreeConfirm, setPendingFreeConfirm] = useState(false);
  // THE ORDER (owner, 2026-09-16): card → account → PLAN → "your card is live"
  // (notifications, and the app on the web) → dashboard + tour. Notifications
  // used to be offered ABOVE the plan cards, before the card was even live,
  // and nothing asked again after the plan was chosen.
  const [setupNext, setSetupNext] = useState<string | null>(
    setupFor === "office" ? "/office/admin" : setupFor === "pro" ? LANDING + "&upgraded=true" : null,
  );
  function finishSetup() {
    // The web dashboard's "Get the app" popup would repeat the card shown here.
    try { localStorage.setItem("sc_appstore_seen", "1"); } catch { /* ignore */ }
    // They just answered the notifications question on this screen; the
    // dashboard's "Know the moment someone connects" nudge must not ask again
    // seconds later (its activity ask can still come once views arrive).
    try { if (!localStorage.getItem("sc_push_nudge_dismissed")) localStorage.setItem("sc_push_nudge_dismissed", "1"); } catch { /* ignore */ }
    router.push(setupNext ?? LANDING);
  }

  useEffect(() => {
    // NATIVE (App Store 3.1.1): never resume a stored paid-plan intent inside
    // the Capacitor shell — the "Complete your subscription" checkout panel is
    // a selling surface. Native always falls through to the plan step, where
    // PlanCards renders only the free continue action. Web unchanged.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time consume of stored intent on mount (reads+clears storage; must not run during render)
    setIntent(detectNativeApp() ? null : (presetIntent ?? consumePlanIntent()));
  }, [presetIntent]);

  // Straight to the dashboard, settling nothing. Used ONLY after a purchase has
  // already happened (onIapPurchased) — they are on a paid plan, so the free
  // settle below must not run and tell the account otherwise.
  function goFree() {
    setLoading(null);
    setSetupNext(LANDING);
  }

  /**
   * "I'll stay on Free" — the gate, mirroring handleAuthedFirstCardFree in
   * NewCardWizard so the two paths cannot drift.
   *
   * A card that uses nothing Pro has nothing to be warned about, so asking
   * would be a pointless extra screen. A card that DOES is not flattened
   * silently: the panel names what changes and offers to keep it on a trial.
   */
  function chooseFree() {
    if (proDesignChanges.length) { setPendingFreeConfirm(true); return; }
    void confirmFree();
  }

  /**
   * They chose Free with their eyes open — make it real.
   *
   * One endpoint rather than three calls because the three things have to
   * happen together (see api/account/choose-plan): the design is converted for
   * good, the plan is marked settled, and THAT is what releases the welcome
   * email. Navigating without it would leave an account whose plan was never
   * decided and which therefore never gets greeted.
   */
  async function confirmFree() {
    setLoading("free");
    setError("");
    try {
      const res = await fetch("/api/account/choose-plan", { method: "POST" });
      if (res.status === 401) { window.location.href = "/login?next=/welcome"; return; }
      if (!res.ok) {
        const { error: err } = await res.json().catch(() => ({ error: null }));
        setError(err || "Couldn't save your plan. Please try again.");
        setLoading(null);
        return;
      }
      setPendingFreeConfirm(false);
      setLoading(null);
      setSetupNext(LANDING);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setLoading(null);
    }
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
          // Back through the "card is live" setup step, then on to the
          // Office dashboard (office) or the dashboard + tour (pro).
          successPath: plan === "office" ? "/welcome?step=setup&for=office" : "/welcome?step=setup&for=pro",
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
        {setupNext !== null ? (
          // ── Step after the plan: the card is live now ───────────────────
          <div className="max-w-md mx-auto text-center">
            <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="text-white font-bold text-2xl sm:text-3xl">Your card is live!</h1>
            {cardSlug && <p className="text-blue-400 text-sm mt-1.5 font-mono">swiftcard.me/{cardSlug}</p>}
            <p className="text-gray-400 text-sm mt-3">We also sent you an email with your link.</p>
            <div className="mt-8 rounded-2xl border border-blue-800/40 bg-blue-950/30 px-4 py-4 mb-3">
              <p className="text-blue-200 font-semibold text-sm">Turn on notifications</p>
              <p className="text-blue-300/80 text-xs mt-1.5 leading-relaxed">Get an instant alert the moment someone shares their info through your card.</p>
            </div>
            <EnablePushButton />
            <GetTheAppCard className="mt-3" />
            <button
              type="button"
              onClick={finishSetup}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-full transition-colors text-sm"
            >
              {setupNext === "/office/admin" ? "Go to my Office dashboard →" : "Go to my dashboard →"}
            </button>
          </div>
        ) : (
        <>
        {/* Header */}
        <div className="text-center mb-8">
          {/* NOT "live" yet: a new account's card goes live when a plan is
              chosen, not before (owner, 2026-09-16; lib/card-active rule 5). */}
          <h1 className="text-white font-bold text-2xl sm:text-3xl">Your account is ready</h1>
          {cardSlug && <p className="text-blue-400 text-sm mt-1.5 font-mono">swiftcard.me/{cardSlug}</p>}
          <p className="text-gray-400 text-sm mt-3 max-w-md mx-auto">Choose your plan below and your card goes live at this link.</p>
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
              className="sc-dark-sheet mt-5 w-full py-3.5 rounded-full text-sm font-bold text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--rd-aurora)" }}
            >
              {loading ? "Redirecting to checkout…" : `Continue to secure checkout →`}
            </button>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-gray-500">
              {paidIntent.plan === "pro" ? "14 days free, then auto-renews. Cancel anytime. " : ""}
              By continuing you agree to our{" "}
              <Link href="/terms" className="underline hover:text-gray-300">Terms</Link> and{" "}
              <Link href="/privacy" className="underline hover:text-gray-300">Privacy Policy</Link>.
            </p>
            {/* chooseFree, not goFree: backing out of checkout is still a
                choice of Free, so it has to settle the plan like any other —
                otherwise this one path leaves an account whose plan was never
                decided, and the welcome email waits forever on a decision that
                already happened. */}
            <button onClick={chooseFree} disabled={loading !== null} className="mt-3 text-gray-500 hover:text-gray-300 text-xs transition-colors">
              Actually, start on the free plan instead →
            </button>
          </div>
        ) : pendingFreeConfirm ? (
          // Free, on a card built with Pro design. Asked HERE because this is
          // where the plan is actually decided — and because the card was
          // stored exactly as designed, "keep it" is a real offer rather than
          // an undo of something already flattened.
          <div className="max-w-md mx-auto">
            <div className="text-center mb-5">
              <h2 className="text-white font-bold text-xl">Before you go Free</h2>
              <p className="text-gray-400 text-sm mt-1.5">One thing to know about the card you just designed.</p>
            </div>
            <FreeDesignChoice
              changes={proDesignChanges}
              onKeepWithTrial={() => checkout("pro", false, 1)}
              onContinueFree={confirmFree}
              onIapPurchased={goFree}
              busy={loading !== null}
            />
            <button
              onClick={() => setPendingFreeConfirm(false)}
              disabled={loading !== null}
              className="mt-4 w-full text-gray-500 hover:text-gray-300 text-xs transition-colors disabled:opacity-50"
            >
              ← Back to plans
            </button>
          </div>
        ) : (
          // THE plan step. Every account passes through here exactly once, with
          // the card already saved and the account already made — so the answer
          // has somewhere real to go the moment it is given.
          <>
            <div className="text-center mb-6">
              <h2 className="text-white font-bold text-xl">Choose your plan</h2>
              <p className="text-gray-400 text-sm mt-1">Your card is saved either way — pick how you want to run it.</p>
            </div>
            <PlanCards onFree={chooseFree} onPaid={checkout} busy={loading} onIapPurchased={goFree} freeLabel="Continue with Free →" />
          </>
        )}

        </>
        )}

        {error && <p className="text-red-400 text-sm text-center mt-5">{error}</p>}
      </div>
    </main>
  );
}
