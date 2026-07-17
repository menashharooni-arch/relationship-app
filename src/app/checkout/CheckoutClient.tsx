"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { detectNativeApp, useIsNativeApp } from "@/lib/platform";
import Link from "next/link";
import { PLAN_PRICES, PLAN_LIMITS, TRIAL_DAYS } from "@/lib/plan";
import { formatUsd, seatSubtotalCents, perMonthCents } from "@/lib/currency";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import { track } from "@/lib/events";

type Plan = "pro" | "office";
type Interval = "monthly" | "annual";

// What Stripe says this plan change costs right now (see /api/stripe/subscription/preview).
type Preview = {
  upgrading: boolean;
  currentPlan: Plan | null;
  currentInterval: Interval | null;
  seats: number;
  prorationDate: number;
  prorationCents: number;
  dueTodayCents: number;
};

const RESUME_KEY = "sc_checkout_resume"; // set before bouncing to login → auto-continue on return

export default function CheckoutClient() {
  const params = useSearchParams();
  const plan: Plan = params.get("plan") === "office" ? "office" : "pro";
  const interval: Interval = params.get("interval") === "annual" ? "annual" : "monthly";
  const seats = plan === "office"
    ? Math.max(PLAN_LIMITS.OFFICE_MIN_SEATS, Math.floor(Number(params.get("seats")) || PLAN_LIMITS.OFFICE_MIN_SEATS))
    : 1;
  // The promo CODE, not a Stripe coupon id — the server re-resolves it (a
  // client-supplied coupon id used to be passed straight to Stripe).
  const promoCode = params.get("promo") || undefined;
  const canceled = params.get("canceled") === "1";
  // ?trial=0 → start-and-pay, no free trial. Set by the in-product upgrade page
  // (/upgrade); the public pricing page omits it and keeps the trial offer.
  // Default true so every existing marketing link behaves exactly as before.
  const trial = params.get("trial") !== "0";

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const native = useIsNativeApp();

  // Native app (App Store 3.1.1): the checkout order summary + Stripe hand-off
  // is a purchase flow and must never appear inside the Capacitor shell — same
  // client-redirect guard as /pricing and /upgrade. No-op on web.
  useEffect(() => {
    if (detectNativeApp()) router.replace("/dashboard");
  }, [router]);

  // An existing subscriber changing plans is NOT a new purchase — Stripe swaps
  // the price on the subscription they already have and prorates it. Starting a
  // second checkout would create a duplicate subscription and bill them twice,
  // so the server rejects that; we detect it up front instead and quote the real
  // prorated amount before they commit to anything.
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  // Per-seat + subtotal in integer cents (shared util → no float artifacts, and
  // the number shown is exactly what Stripe is asked to charge).
  const perSeatCents = plan === "office"
    ? (interval === "annual" ? PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS : PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS)
    : (interval === "annual" ? PLAN_PRICES.PRO_ANNUAL_CENTS : PLAN_PRICES.PRO_MONTHLY_CENTS);
  const subtotalCents = seatSubtotalCents(perSeatCents, seats);
  const per = interval === "annual" ? "yr" : "mo";

  // Ask Stripe what this change costs. 401 (guest) / 409 (no subscription yet)
  // both simply mean "this is a normal first-time purchase" — not an error.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/stripe/subscription/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, interval, seats }),
        });
        if (!alive) return;
        if (res.ok) setPreview((await res.json()) as Preview);
      } catch {
        // Quote unavailable → fall back to the normal checkout path.
      } finally {
        if (alive) setPreviewLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [plan, interval, seats]);

  // Existing subscriber → swap the price on the subscription they already have,
  // prorated, at the timestamp we quoted from.
  const changePlan = useCallback(async (p: Preview) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/subscription/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, seats, prorationDate: p.prorationDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.needsCheckout) {
        setPreview(null); // subscription vanished under us → fall back to checkout
        setErr("Your subscription couldn't be found. Continue to secure payment instead.");
        return;
      }
      if (!res.ok) { setErr(data.error || "Couldn't change your plan. Please try again."); return; }
      window.location.href = `/checkout/success?plan=${plan}`;
    } catch {
      setErr("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [plan, interval, seats]);

  const start = useCallback(async () => {
    // Already paying → this is a plan change, not a second subscription.
    if (preview) { await changePlan(preview); return; }

    setBusy(true);
    setErr(null);
    track("checkout_started", { plan, interval, seats, variant: trial ? "with_trial" : "no_trial" });
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, seats, trial, ...(promoCode ? { promoCode } : {}) }),
      });
      if (res.status === 401) {
        // Not signed in → create account / log in, then auto-resume here.
        try { sessionStorage.setItem(RESUME_KEY, "1"); } catch { /* ignore */ }
        const here = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?mode=signup&next=${encodeURIComponent(here)}`;
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.redirect) {
        // Already subscribed but we had no quote (preview failed) — send them to
        // Billing rather than risk a duplicate subscription.
        window.location.href = data.redirect;
        return;
      }
      if (data.url) { window.location.href = data.url; return; }
      setErr(data.error || data.message || "Couldn't start checkout. Please try again.");
    } catch {
      setErr("Couldn't reach checkout. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [plan, interval, seats, promoCode, trial, preview, changePlan]);

  // Auto-continue after returning from account creation / login (spec §1:
  // "automatically continue to checkout for the originally selected plan").
  useEffect(() => {
    // Native: never auto-resume a Stripe hand-off inside the shell — the
    // redirect-to-dashboard effect above wins (App Store 3.1.1).
    if (detectNativeApp()) return;
    let resume = false;
    try { resume = sessionStorage.getItem(RESUME_KEY) === "1"; } catch { /* ignore */ }
    if (resume) {
      try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-login resume: reads+clears a storage flag on mount, then kicks off the checkout request (which sets busy state)
      start();
    }
  }, [start]);

  const planName = plan === "office" ? "Office" : "Pro";

  // After all hooks (safe when `native` flips post-mount): render nothing on
  // native while the redirect effect runs — no one-frame flash of the order
  // summary inside the shell.
  if (native) return null;

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-center gap-2 mb-6">
        <SwiftCardIcon size={26} />
        <span className="text-white font-bold tracking-tight">SwiftCard</span>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h1 className="text-white text-xl font-bold mb-1">
          {preview ? `${preview.upgrading ? "Upgrade" : "Switch"} to ${planName}` : "Review your order"}
        </h1>
        <p className="text-gray-500 text-sm mb-5">
          {preview
            ? `You're on ${preview.currentPlan === "office" ? "Office" : "Pro"}. We'll adjust your existing subscription — no second charge, and you keep your billing date.`
            : "Confirm the details below, then continue to secure payment."}
        </p>

        {canceled && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5">
            <p className="text-amber-300 text-xs font-semibold">Checkout canceled — your selection is saved.</p>
            <p className="text-amber-200/80 text-[11px] mt-0.5">Pick up right where you left off whenever you&apos;re ready.</p>
          </div>
        )}

        <dl className="space-y-2.5 text-sm">
          <Row label="Plan"><span className="text-white font-semibold">{planName}</span></Row>
          <Row label="Billing"><span className="text-white">{interval === "annual" ? "Annual" : "Monthly"}</span></Row>
          {plan === "office" && (
            <>
              <Row label="Seats"><span className="text-white">{seats} (incl. you)</span></Row>
              <Row label="Price per seat"><span className="text-white">{formatUsd(perSeatCents)}/{per}</span></Row>
            </>
          )}
          <div className="h-px bg-gray-800 my-1.5" />
          <Row label="Subtotal"><span className="text-white font-semibold">{formatUsd(subtotalCents)}</span></Row>
          {plan === "office" && interval === "annual" && (
            <Row label="Per user / month"><span className="text-gray-400">≈ {formatUsd(perMonthCents(PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS))}/mo</span></Row>
          )}
          <Row label="Recurring total"><span className="text-white font-semibold">{formatUsd(subtotalCents)}/{per}</span></Row>
          <Row label="Renews"><span className="text-gray-400">Every {interval === "annual" ? "year" : "month"}, auto-renews unless canceled</span></Row>

          {/* The prorated difference — Stripe's own figure, not ours. */}
          {preview && (
            <>
              <div className="h-px bg-gray-800 my-1.5" />
              {preview.upgrading ? (
                <Row label="Due today">
                  <span className="text-white font-semibold">{formatUsd(preview.dueTodayCents)}</span>
                </Row>
              ) : (
                <Row label="Credit applied">
                  <span className="text-white font-semibold">{formatUsd(Math.abs(preview.prorationCents))}</span>
                </Row>
              )}
            </>
          )}
        </dl>

        {preview && (
          <p className="text-gray-500 text-[11px] mt-3 leading-relaxed">
            {preview.upgrading
              ? `Charged today to the card on file. You're credited for the unused time on ${preview.currentPlan === "office" ? "Office" : "Pro"}, so you only pay the difference — then ${formatUsd(subtotalCents)}/${per} from your next billing date.`
              : `Applied as a credit against your next invoice rather than refunded, then ${formatUsd(subtotalCents)}/${per} from your next billing date.`}
          </p>
        )}

        {/* Trial + "calculated at checkout" copy only applies to a NEW
            subscription — an existing subscriber gets neither. The trial line
            must not appear when trial=0, or we'd be promising a free trial the
            checkout session won't create. */}
        {!preview && plan === "pro" && (
          <p className="text-gray-500 text-[11px] mt-3 leading-relaxed">
            {trial
              ? `First-time subscribers start with a ${TRIAL_DAYS}-day free trial. Card required — billing begins automatically after the trial unless you cancel. Taxes, discounts, and any proration are calculated at checkout.`
              : "Billing starts today and renews automatically until you cancel. Taxes, discounts, and any proration are calculated at checkout."}
          </p>
        )}
        {plan === "office" && (
          <p className="text-gray-500 text-[11px] mt-3 leading-relaxed">
            Your own card counts as seat 1 — {preview ? "invite the rest of your team from the Admin page." : "after payment, invite the rest of your team from the Office dashboard. Taxes and any discounts are calculated at checkout."}
          </p>
        )}

        {err && <p className="mt-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs px-3 py-2">{err}</p>}

        <button
          onClick={start}
          disabled={busy || previewLoading}
          className="mt-5 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-full transition-colors"
        >
          {previewLoading
            ? "Checking your plan…"
            : preview
              ? (busy
                  ? "Updating your plan…"
                  : preview.upgrading
                    ? `Upgrade to ${planName} — pay ${formatUsd(preview.dueTodayCents)} today →`
                    : `Switch to ${planName} →`)
              : (busy ? "Redirecting to secure checkout…" : "Continue to secure payment →")}
        </button>

        <p className="text-center text-gray-500 text-[11px] mt-3 leading-relaxed">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-gray-300">Terms</Link> and{" "}
          <Link href="/privacy" className="underline hover:text-gray-300">Privacy Policy</Link>
          {plan === "pro" && trial
            ? ", including that your subscription auto-renews after any free trial until you cancel."
            : ", including that your subscription auto-renews until you cancel."}
        </p>

        <Link href={trial ? "/pricing" : "/upgrade"} className="block text-center text-gray-500 hover:text-gray-300 text-xs mt-3 transition-colors">
          ← Change plan, billing, or seats
        </Link>
      </div>

      <p className="text-center text-gray-600 text-[11px] mt-4">Payments are securely processed by Stripe. We never store your card details.</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
