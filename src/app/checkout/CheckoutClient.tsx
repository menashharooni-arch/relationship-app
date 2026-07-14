"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PLAN_PRICES, PLAN_LIMITS, TRIAL_DAYS } from "@/lib/plan";
import { formatUsd, seatSubtotalCents, perMonthCents } from "@/lib/currency";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";

type Plan = "pro" | "office";
type Interval = "monthly" | "annual";

const RESUME_KEY = "sc_checkout_resume"; // set before bouncing to login → auto-continue on return

export default function CheckoutClient() {
  const params = useSearchParams();
  const plan: Plan = params.get("plan") === "office" ? "office" : "pro";
  const interval: Interval = params.get("interval") === "annual" ? "annual" : "monthly";
  const seats = plan === "office"
    ? Math.max(PLAN_LIMITS.OFFICE_MIN_SEATS, Math.floor(Number(params.get("seats")) || PLAN_LIMITS.OFFICE_MIN_SEATS))
    : 1;
  const coupon = params.get("coupon") || undefined;
  const canceled = params.get("canceled") === "1";

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Per-seat + subtotal in integer cents (shared util → no float artifacts, and
  // the number shown is exactly what Stripe is asked to charge).
  const perSeatCents = plan === "office"
    ? (interval === "annual" ? PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS : PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS)
    : (interval === "annual" ? PLAN_PRICES.PRO_ANNUAL_CENTS : PLAN_PRICES.PRO_MONTHLY_CENTS);
  const subtotalCents = seatSubtotalCents(perSeatCents, seats);
  const per = interval === "annual" ? "yr" : "mo";

  const start = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, seats, ...(coupon ? { couponId: coupon } : {}) }),
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
        // Already subscribed → manage the plan instead of double-charging.
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
  }, [plan, interval, seats, coupon]);

  // Auto-continue after returning from account creation / login (spec §1:
  // "automatically continue to checkout for the originally selected plan").
  useEffect(() => {
    let resume = false;
    try { resume = sessionStorage.getItem(RESUME_KEY) === "1"; } catch { /* ignore */ }
    if (resume) {
      try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
      start();
    }
  }, [start]);

  const planName = plan === "office" ? "Office" : "Pro";

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-center gap-2 mb-6">
        <SwiftCardIcon size={26} />
        <span className="text-white font-bold tracking-tight">SwiftCard</span>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h1 className="text-white text-xl font-bold mb-1">Review your order</h1>
        <p className="text-gray-500 text-sm mb-5">Confirm the details below, then continue to secure payment.</p>

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
        </dl>

        {plan === "pro" && (
          <p className="text-gray-500 text-[11px] mt-3 leading-relaxed">
            First-time subscribers start with a {TRIAL_DAYS}-day free trial. Card required — billing begins automatically after the trial unless you cancel. Taxes, discounts, and any proration are calculated at checkout.
          </p>
        )}
        {plan === "office" && (
          <p className="text-gray-500 text-[11px] mt-3 leading-relaxed">
            You&apos;ll create your own card first (it counts as seat 1), then invite your team from the Office dashboard. Taxes and any discounts are calculated at checkout.
          </p>
        )}

        {err && <p className="mt-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs px-3 py-2">{err}</p>}

        <button
          onClick={start}
          disabled={busy}
          className="mt-5 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-full transition-colors"
        >
          {busy ? "Redirecting to secure checkout…" : "Continue to secure payment →"}
        </button>

        <p className="text-center text-gray-500 text-[11px] mt-3 leading-relaxed">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-gray-300">Terms</Link> and{" "}
          <Link href="/privacy" className="underline hover:text-gray-300">Privacy Policy</Link>
          {plan === "pro" ? ", including that your subscription auto-renews after any free trial until you cancel." : "."}
        </p>

        <Link href="/pricing" className="block text-center text-gray-500 hover:text-gray-300 text-xs mt-3 transition-colors">
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
