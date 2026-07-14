"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAN_PRICES, PLAN_LIMITS } from "@/lib/plan";
import { formatUsd, seatSubtotalCents } from "@/lib/currency";
import ManageBillingButton from "@/components/ManageBillingButton";

// ── In-app subscription manager (Settings > Billing) ─────────────────────────
// Native UI over our own /api/stripe/subscription/* endpoints — NOT the Stripe
// hosted portal — so we fully control the copy and the flows the owner asked
// for: separate Change Plan / Cancel / Keep actions, a reason prompt + 50%
// retention offer on cancel, and Office seat management. The Stripe portal is
// still offered for payment-method + invoice history, where its copy is fine.

type Sub = {
  plan: "free" | "pro" | "office";
  interval: "monthly" | "annual" | null;
  status: string | null;
  seats: number | null;
  activeMembers: number | null;
  minSeats: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  renewalCents: number | null;
  retentionUsed: boolean;
  paymentFailed: boolean;
  hasStripeSubscription: boolean;
  hasCustomer: boolean;
};

const CANCEL_REASONS = [
  "Too expensive",
  "Not using it enough",
  "Missing a feature I need",
  "Found a better alternative",
  "Just testing it out",
  "Other",
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

const planLabel = (p: Sub["plan"]) => (p === "office" ? "Office" : p === "pro" ? "Pro" : "Free");

export default function BillingManager() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [showChange, setShowChange] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/subscription");
      if (!res.ok) throw new Error();
      setSub(await res.json());
    } catch {
      setErr("Couldn't load your billing details. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Deep-link from receipt / payment emails (?billing=1) → scroll Billing into view.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("billing") === "1") {
        document.getElementById("billing")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch { /* noop */ }
  }, []);

  async function keepSubscription() {
    setBusy("keep"); setErr(null); setNotice(null);
    try {
      const res = await fetch("/api/stripe/subscription/keep", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Something went wrong."); return; }
      setNotice(`Your subscription is active again${data.renewalAt ? ` and renews on ${fmtDate(data.renewalAt)}` : ""}.`);
      await load();
    } catch {
      setErr("Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-500">Loading billing…</div>;
  }
  if (!sub) {
    return <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-red-400">{err ?? "Unavailable."}</div>;
  }

  const isPaid = sub.plan === "pro" || sub.plan === "office";
  const renewalLine = sub.renewalCents != null
    ? `${formatUsd(sub.renewalCents)}/${sub.interval === "annual" ? "yr" : "mo"}`
    : null;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      {/* Current plan */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-400">Current plan</p>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isPaid ? "bg-blue-500/15 text-blue-300" : "bg-gray-800 text-gray-400"}`}>
          {planLabel(sub.plan)}{sub.plan === "office" && sub.seats ? ` · ${sub.seats} seats` : ""}
        </span>
      </div>

      {isPaid && !sub.cancelAtPeriodEnd && (
        <p className="text-xs text-gray-500 mb-4">
          {renewalLine ? `${renewalLine} · ` : ""}Renews {fmtDate(sub.currentPeriodEnd)}
        </p>
      )}
      {!isPaid && <p className="text-xs text-gray-500 mb-4">Pro unlocks unlimited cards, analytics, custom design, and removes SwiftCard branding.</p>}

      {sub.paymentFailed && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
          <p className="text-amber-300 text-xs font-semibold">Your last payment didn&apos;t go through.</p>
          <p className="text-amber-200/80 text-[11px] mt-0.5">Update your payment method to keep Pro — your access continues during the grace period.</p>
        </div>
      )}

      {/* Scheduled-cancellation banner + Keep Subscription */}
      {sub.cancelAtPeriodEnd && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
          <p className="text-amber-300 text-xs font-semibold">
            Scheduled to cancel on {fmtDate(sub.currentPeriodEnd)}
          </p>
          <p className="text-amber-200/80 text-[11px] mt-0.5 mb-3">
            You&apos;ll keep {planLabel(sub.plan)} until then, after which your account moves to Free.
          </p>
          <button
            onClick={keepSubscription}
            disabled={busy === "keep"}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-full transition-colors"
          >
            {busy === "keep" ? "Reactivating…" : "Keep Subscription"}
          </button>
        </div>
      )}

      {notice && <p className="mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs px-3 py-2">{notice}</p>}
      {err && <p className="mb-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs px-3 py-2">{err}</p>}

      {/* Office seat management */}
      {sub.plan === "office" && !sub.cancelAtPeriodEnd && (
        <SeatManager sub={sub} onChanged={load} />
      )}

      {/* Actions */}
      <div className="space-y-2.5 mt-4">
        {!isPaid && (
          <a href="/pricing" className="block text-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-2.5 rounded-full transition-colors">
            Upgrade to Pro →
          </a>
        )}

        {isPaid && (
          <button
            onClick={() => { setShowChange(true); setErr(null); setNotice(null); }}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm py-2.5 rounded-full transition-colors"
          >
            Change Plan
          </button>
        )}

        {/* Payment method + invoices via the Stripe portal (its copy is fine here). */}
        {sub.hasCustomer && <ManageBillingButton />}

        {isPaid && !sub.cancelAtPeriodEnd && (
          <button
            onClick={() => { setShowCancel(true); setErr(null); setNotice(null); }}
            className="w-full text-gray-500 hover:text-gray-300 text-xs font-medium py-2 transition-colors"
          >
            Cancel subscription
          </button>
        )}
      </div>

      {showChange && (
        <ChangePlanModal
          sub={sub}
          onClose={() => setShowChange(false)}
          onCancelInstead={() => { setShowChange(false); setShowCancel(true); }}
          onChanged={async (msg) => { setShowChange(false); setNotice(msg); await load(); }}
        />
      )}
      {showCancel && (
        <CancelModal
          sub={sub}
          onClose={() => setShowCancel(false)}
          onDone={async (msg) => { setShowCancel(false); setNotice(msg); await load(); }}
        />
      )}
    </div>
  );
}

// ── Office seat manager ───────────────────────────────────────────────────────
function SeatManager({ sub, onChanged }: { sub: Sub; onChanged: () => Promise<void> }) {
  const [seats, setSeats] = useState(sub.seats ?? sub.minSeats);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const floor = Math.max(sub.minSeats, sub.activeMembers ?? 0);
  const changed = seats !== (sub.seats ?? sub.minSeats);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/stripe/subscription/seats", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Couldn't update seats."); return; }
      setMsg(`Seats updated to ${data.seats}. Your next invoice is prorated.`);
      await onChanged();
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3.5 mb-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-300">Team seats</p>
        <p className="text-[11px] text-gray-500">{sub.activeMembers ?? 0} active · min {sub.minSeats}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setSeats((s) => Math.max(floor, s - 1))} disabled={seats <= floor}
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-bold">−</button>
          <span className="w-10 text-center text-white font-bold tabular-nums">{seats}</span>
          <button onClick={() => setSeats((s) => s + 1)}
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold">+</button>
        </div>
        <span className="text-xs text-gray-500">
          {`${formatUsd(seatSubtotalCents(sub.interval === "annual" ? PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS : PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS, seats))}/${sub.interval === "annual" ? "yr" : "mo"}`}
        </span>
        {changed && (
          <button onClick={save} disabled={busy}
            className="ml-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            {busy ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      {msg && <p className="text-[11px] text-gray-400 mt-2">{msg}</p>}
      {floor > sub.minSeats && seats <= floor && (
        <p className="text-[11px] text-gray-600 mt-1.5">Remove members to go below {floor} seats.</p>
      )}
    </div>
  );
}

// ── Change Plan modal ─────────────────────────────────────────────────────────
function ChangePlanModal({ sub, onClose, onCancelInstead, onChanged }: {
  sub: Sub;
  onClose: () => void;
  onCancelInstead: () => void;
  onChanged: (msg: string) => Promise<void>;
}) {
  const [interval, setInterval] = useState<"monthly" | "annual">(sub.interval ?? "monthly");
  const [seats, setSeats] = useState(sub.seats ?? PLAN_LIMITS.OFFICE_MIN_SEATS);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function choose(plan: "pro" | "office") {
    setBusy(plan); setErr(null);
    try {
      const res = await fetch("/api/stripe/subscription/change-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, seats: plan === "office" ? seats : undefined }),
      });
      const data = await res.json();
      if (res.status === 409 && data.needsCheckout) {
        // No subscription yet → send them through checkout to add a card.
        window.location.href = "/pricing";
        return;
      }
      if (!res.ok) { setErr(data.error || "Couldn't change plan."); return; }
      await onChanged(`You're now on ${plan === "office" ? "Office" : "Pro"} (${interval}). Charges are prorated.`);
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const proMo = interval === "annual"
    ? `${formatUsd(PLAN_PRICES.PRO_ANNUAL_CENTS)}/yr` : `${formatUsd(PLAN_PRICES.PRO_MONTHLY_CENTS)}/mo`;
  const officePer = interval === "annual"
    ? `${formatUsd(PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS)}/yr` : `${formatUsd(PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS)}/mo`;

  return (
    <Modal onClose={onClose} title="Change plan">
      <div className="flex items-center justify-center gap-2 mb-4">
        {(["monthly", "annual"] as const).map((iv) => (
          <button key={iv} onClick={() => setInterval(iv)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${interval === iv ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
            {iv === "monthly" ? "Monthly" : "Annual · save 10%"}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {/* Pro */}
        <PlanRow
          name="Pro" price={proMo} desc="Unlimited everything, for one person."
          current={sub.plan === "pro"}
          busy={busy === "pro"}
          onSelect={() => choose("pro")}
        />
        {/* Office */}
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">Office <span className="text-gray-500 font-normal">· {officePer}/seat</span></p>
              <p className="text-gray-500 text-[11px]">One brand across your whole team.</p>
            </div>
            {sub.plan === "office"
              ? <span className="text-[11px] font-bold text-blue-300">Current</span>
              : (
                <button onClick={() => choose("office")} disabled={busy === "office"}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  {busy === "office" ? "…" : "Switch"}
                </button>
              )}
          </div>
          {(sub.plan !== "office") && (
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[11px] text-gray-500">Seats:</span>
              <button onClick={() => setSeats((s) => Math.max(PLAN_LIMITS.OFFICE_MIN_SEATS, s - 1))}
                className="w-6 h-6 rounded bg-gray-800 text-white text-sm">−</button>
              <span className="w-6 text-center text-white text-xs tabular-nums">{seats}</span>
              <button onClick={() => setSeats((s) => s + 1)} className="w-6 h-6 rounded bg-gray-800 text-white text-sm">+</button>
            </div>
          )}
        </div>

        {/* Move to Free = cancel (kept as a separate, honest action) */}
        <button onClick={onCancelInstead}
          className="w-full text-left rounded-xl border border-gray-800 bg-gray-950/50 p-3.5 hover:border-gray-700 transition-colors">
          <p className="text-white font-semibold text-sm">Switch to Free</p>
          <p className="text-gray-500 text-[11px]">Cancel your paid plan. Keeps your account, cards & contacts.</p>
        </button>
      </div>

      {err && <p className="mt-3 text-red-400 text-xs text-center">{err}</p>}
    </Modal>
  );
}

function PlanRow({ name, price, desc, current, busy, onSelect }: {
  name: string; price: string; desc: string; current: boolean; busy: boolean; onSelect: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3.5 flex items-center justify-between">
      <div>
        <p className="text-white font-semibold text-sm">{name} <span className="text-gray-500 font-normal">· {price}</span></p>
        <p className="text-gray-500 text-[11px]">{desc}</p>
      </div>
      {current
        ? <span className="text-[11px] font-bold text-blue-300">Current</span>
        : (
          <button onClick={onSelect} disabled={busy}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            {busy ? "…" : "Switch"}
          </button>
        )}
    </div>
  );
}

// ── Cancel flow: reason → 50% offer → confirm ─────────────────────────────────
function CancelModal({ sub, onClose, onDone }: {
  sub: Sub;
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
}) {
  const [step, setStep] = useState<"reason" | "offer" | "confirming">("reason");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function next() {
    if (!reason) { setErr("Please pick a reason so we can improve."); return; }
    setErr(null);
    // Show the retention offer unless it's already been used.
    setStep(sub.retentionUsed ? "confirming" : "offer");
  }

  async function acceptOffer() {
    setBusy("offer"); setErr(null);
    try {
      const res = await fetch("/api/stripe/subscription/discount", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Couldn't apply the discount."); return; }
      await onDone("Great news — 50% off for your next 3 months is applied. Your plan stays active.");
    } catch {
      setErr("Couldn't reach the server.");
    } finally { setBusy(null); }
  }

  async function confirmCancel() {
    setBusy("cancel"); setErr(null);
    try {
      const res = await fetch("/api/stripe/subscription/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, comment }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Couldn't schedule cancellation."); return; }
      await onDone(`Your plan is scheduled to end on ${fmtDate(data.cancelAt)}. You keep ${sub.plan === "office" ? "Office" : "Pro"} until then.`);
    } catch {
      setErr("Couldn't reach the server.");
    } finally { setBusy(null); }
  }

  return (
    <Modal onClose={onClose} title={step === "offer" ? "Before you go" : "Cancel subscription"}>
      {step === "reason" && (
        <>
          <p className="text-gray-400 text-sm mb-3">What&apos;s making you cancel? This helps us improve.</p>
          <div className="space-y-1.5 mb-3">
            {CANCEL_REASONS.map((r) => (
              <button key={r} onClick={() => setReason(r)}
                className={`w-full text-left text-sm px-3.5 py-2.5 rounded-xl border transition-colors ${reason === r ? "border-blue-500 bg-blue-500/10 text-white" : "border-gray-800 bg-gray-950/50 text-gray-300 hover:border-gray-700"}`}>
                {r}
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
            placeholder="Anything else? (optional)"
            className="w-full rounded-xl bg-gray-950 border border-gray-800 text-sm text-white px-3.5 py-2.5 mb-3 focus:outline-none focus:border-gray-600" />
          {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm py-2.5 rounded-full">Never mind</button>
            <button onClick={next} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm py-2.5 rounded-full">Continue</button>
          </div>
        </>
      )}

      {step === "offer" && (
        <>
          <div className="text-center mb-4">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-300 font-black text-lg">50%</span>
            </div>
            <p className="text-white font-bold text-base">Stay for 50% off — 3 months</p>
            <p className="text-gray-400 text-sm mt-1">Keep every {sub.plan === "office" ? "Office" : "Pro"} feature at half price for your next three billing cycles. One-time offer.</p>
          </div>
          {err && <p className="text-red-400 text-xs mb-3 text-center">{err}</p>}
          <div className="space-y-2.5">
            <button onClick={acceptOffer} disabled={busy !== null}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-full">
              {busy === "offer" ? "Applying…" : "Apply 50% off & keep my plan"}
            </button>
            <button onClick={() => { setStep("confirming"); setErr(null); }} disabled={busy !== null}
              className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 font-semibold text-sm py-3 rounded-full">
              Continue canceling
            </button>
          </div>
        </>
      )}

      {step === "confirming" && (
        <>
          <p className="text-gray-300 text-sm mb-2">
            Your {sub.plan === "office" ? "Office" : "Pro"} plan will stay active until <strong className="text-white">{fmtDate(sub.currentPeriodEnd)}</strong>, then your account moves to Free automatically. No further charges.
          </p>
          <p className="text-gray-500 text-xs mb-4">Your cards and contacts are kept. You can reactivate anytime before then.</p>
          {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm py-2.5 rounded-full">Keep my plan</button>
            <button onClick={confirmCancel} disabled={busy !== null}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-full">
              {busy === "cancel" ? "Canceling…" : "Confirm cancellation"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Shared modal shell ────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
