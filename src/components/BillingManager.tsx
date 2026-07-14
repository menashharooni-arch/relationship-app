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
  pendingInvites: number | null;
  ownerSeats: number;
  scheduledSeats: number | null;
  scheduledSeatsAt: string | null;
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

// A price cut only changes a price-driven decision. Offering 50% off to someone
// leaving over a missing feature or "just testing" burns margin on people it
// won't keep, so the discount is reserved for genuinely price-sensitive reasons.
// (The Office→Pro save below is offered to every Office canceller — it's a real
// downgrade to a cheaper plan, not a giveaway.)
const PRICE_SENSITIVE_REASONS = ["Too expensive", "Found a better alternative"];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

const planLabel = (p: Sub["plan"]) => (p === "office" ? "Office" : p === "pro" ? "Pro" : "Free");

// What a paid account actually loses when it drops to Free. These are the real,
// code-enforced consequences (card-active kill-switch, sanitizeCustomizationForPlan
// at render, the Free monthly meters) — NOT scare copy. Nothing is deleted, but
// access to everything past the Free tier stops the moment the plan lapses, which
// is exactly what the visitor is deciding to give up. Listing it plainly is both
// honest and the strongest reason to stay.
function downgradeLosses(plan: Sub["plan"]): string[] {
  const losses: string[] = [];
  if (plan === "office") {
    losses.push("Every teammate's card goes offline — their links, QR codes, NFC taps and Apple Wallet passes stop working, and all seats are released.");
  }
  losses.push(
    plan === "office"
      ? "Only your own first card stays live; your unified team branding is removed."
      : "Only your first card stays live — every other card's links, QR codes, NFC taps, Apple Wallet passes and lead capture stop working.",
  );
  losses.push(`Your live card reverts to the Free design and keeps just ${PLAN_LIMITS.FREE_MAX_LINKS} Swift Link — Pro styling and your extra action buttons disappear from it.`);
  losses.push(`New contacts are capped at ${PLAN_LIMITS.FREE_LEADS_PER_MONTH}/month again — anything past that is locked until you upgrade.`);
  losses.push(`AI card scanning and follow-up drafts drop to ${PLAN_LIMITS.FREE_SCANS_PER_MONTH}/month.`);
  return losses;
}

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
  const active = sub.activeMembers ?? 0;
  const pending = sub.pendingInvites ?? 0;
  const used = 1 /* owner */ + active + pending; // seats in use — can't reduce below this
  const available = Math.max(0, (sub.seats ?? sub.minSeats) - used);
  const floor = Math.max(sub.minSeats, used);
  const changed = seats !== (sub.seats ?? sub.minSeats);

  const current = sub.seats ?? sub.minSeats;
  const perSeatCents = sub.interval === "annual" ? PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS : PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS;
  const per = sub.interval === "annual" ? "yr" : "mo";

  async function submit(targetSeats: number) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/stripe/subscription/seats", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats: targetSeats }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Couldn't update seats."); return; }
      if (data.mode === "increased") setMsg(`Seats increased to ${data.seats}. Your next invoice is prorated.`);
      else if (data.mode === "scheduled") setMsg(`Scheduled to reduce to ${data.scheduledSeats} on ${fmtDate(data.effectiveAt)}. Current seats stay until then.`);
      else if (data.mode === "unchanged") setMsg("Scheduled reduction canceled — you'll keep your current seats.");
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
        <p className="text-[11px] text-gray-500">{available} available · min {sub.minSeats}</p>
      </div>
      <p className="text-[11px] text-gray-500 mb-2">
        {current} purchased · you + {active} active + {pending} pending = {used} used
      </p>

      {/* Scheduled reduction banner (spec §5) — current vs future clearly distinct */}
      {sub.scheduledSeats != null && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <p className="text-amber-300 text-[11px] font-semibold">
            Scheduled to reduce {current} → {sub.scheduledSeats} seats on {fmtDate(sub.scheduledSeatsAt)}
          </p>
          <p className="text-amber-200/80 text-[11px] mt-0.5">
            {formatUsd(seatSubtotalCents(perSeatCents, current))}/{per} now → {formatUsd(seatSubtotalCents(perSeatCents, sub.scheduledSeats))}/{per} after. You keep {current} seats until then.
          </p>
          <button onClick={() => submit(current)} disabled={busy}
            className="mt-2 text-[11px] font-semibold text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 py-1.5 rounded-full">
            {busy ? "…" : "Cancel scheduled reduction"}
          </button>
        </div>
      )}
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
          <button onClick={() => submit(seats)} disabled={busy}
            className="ml-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            {busy ? "Saving…" : seats > current ? "Add seats" : "Schedule reduction"}
          </button>
        )}
      </div>
      {changed && seats < current && (
        <p className="text-[11px] text-gray-500 mt-1.5">Reductions take effect at the end of your billing period; you keep {current} seats until then.</p>
      )}
      {msg && <p className="text-[11px] text-gray-400 mt-2">{msg}</p>}
      {floor > sub.minSeats && seats <= floor && (
        <p className="text-[11px] text-gray-600 mt-1.5">Remove members or revoke invitations to go below {floor} seats.</p>
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

        {/* Move to Free = cancel. Kept as a separate, honest, visually quiet action
            (it's the one path that loses the customer value — no reason to dress it
            up). The copy states the real downgrade consequence instead of the old,
            misleading "keeps your cards & contacts". */}
        <button onClick={onCancelInstead}
          className="w-full text-left rounded-xl border border-gray-800/70 bg-gray-950/40 p-3.5 hover:border-gray-700 transition-colors">
          <p className="text-gray-300 font-semibold text-sm">Switch to Free</p>
          <p className="text-gray-500 text-[11px]">Downgrades your account — extra cards go offline and your card loses its Pro design. See exactly what changes first.</p>
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

  // What we can offer to keep them, decided by plan + reason:
  //  • Office → downgrade to Pro instead of churning to $0 (keeps their card +
  //    their money, just drops the team). Offered to every Office canceller.
  //  • 50% off for 3 months → only for price-sensitive reasons, once per customer.
  const canOfferPro = sub.plan === "office";
  const canOfferDiscount = !sub.retentionUsed && PRICE_SENSITIVE_REASONS.includes(reason);

  const proCents = (sub.interval ?? "monthly") === "annual" ? PLAN_PRICES.PRO_ANNUAL_CENTS : PLAN_PRICES.PRO_MONTHLY_CENTS;
  const proLabel = `${formatUsd(proCents)}/${(sub.interval ?? "monthly") === "annual" ? "yr" : "mo"}`;

  function next() {
    if (!reason) { setErr("Please pick a reason so we can improve."); return; }
    setErr(null);
    // Only interrupt with the save step if we actually have something to offer.
    setStep(canOfferPro || canOfferDiscount ? "offer" : "confirming");
  }

  async function switchToPro() {
    setBusy("pro"); setErr(null);
    try {
      const res = await fetch("/api/stripe/subscription/change-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", interval: sub.interval ?? "monthly" }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Couldn't switch to Pro. Please try again."); return; }
      await onDone(`You're now on Pro (${proLabel}) — your own card stays active. Your team's seats have ended and their cards revert to their own plans.`);
    } catch {
      setErr("Couldn't reach the server.");
    } finally { setBusy(null); }
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
            <button onClick={onClose} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-2.5 rounded-full">Never mind, keep it</button>
            <button onClick={next} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm py-2.5 rounded-full">Continue</button>
          </div>
        </>
      )}

      {step === "offer" && (
        <>
          {/* Office → Pro: keep your own card on a cheaper plan instead of losing
              everything to Free. The strongest save for a single owner who no
              longer needs a whole team. */}
          {canOfferPro && (
            <div className="rounded-2xl border border-blue-700/40 bg-blue-950/30 p-4 mb-3">
              <p className="text-white font-bold text-base">Don&apos;t need the team? Switch to Pro</p>
              <p className="text-gray-300 text-sm mt-1">Keep your own card and every Pro feature for just <span className="text-white font-semibold">{proLabel}</span> — instead of dropping all the way to Free.</p>
              <p className="text-gray-500 text-[11px] mt-1.5">Your team&apos;s seats end and their cards revert to their own plans. Prorated — you&apos;re only charged the difference.</p>
              <button onClick={switchToPro} disabled={busy !== null}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-full">
                {busy === "pro" ? "Switching…" : `Switch to Pro · ${proLabel}`}
              </button>
            </div>
          )}

          {/* 50% off — only surfaced for price-sensitive reasons (see next()). */}
          {canOfferDiscount && (
            <div className="rounded-2xl border border-emerald-600/30 bg-emerald-950/20 p-4 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <span className="text-emerald-300 font-black text-sm">50%</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{canOfferPro ? "Or keep it at 50% off" : "Stay for 50% off — 3 months"}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Half price on {sub.plan === "office" ? "Office" : "Pro"} for your next 3 billing cycles. One-time offer.</p>
                </div>
              </div>
              <button onClick={acceptOffer} disabled={busy !== null}
                className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-full">
                {busy === "offer" ? "Applying…" : "Apply 50% off & keep my plan"}
              </button>
            </div>
          )}

          {err && <p className="text-red-400 text-xs mb-3 text-center">{err}</p>}
          <button onClick={() => { setStep("confirming"); setErr(null); }} disabled={busy !== null}
            className="w-full text-gray-500 hover:text-gray-300 disabled:opacity-50 font-semibold text-xs py-1.5">
            No thanks, continue canceling
          </button>
        </>
      )}

      {step === "confirming" && (
        <>
          <p className="text-gray-300 text-sm mb-3">
            You keep {sub.plan === "office" ? "Office" : "Pro"} until <strong className="text-white">{fmtDate(sub.currentPeriodEnd)}</strong> (no further charges). After that your account drops to Free and:
          </p>
          <ul className="space-y-1.5 mb-3">
            {downgradeLosses(sub.plan).map((loss, i) => (
              <li key={i} className="flex gap-2 text-gray-400 text-xs leading-relaxed">
                <span className="mt-0.5 text-red-400/90 shrink-0" aria-hidden>✕</span>
                <span>{loss}</span>
              </li>
            ))}
          </ul>
          <p className="text-gray-500 text-[11px] mb-4">Nothing is deleted — re-subscribe anytime and it all switches back on instantly.</p>
          {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
          {/* Primary emphasis on staying (the profitable choice); downgrade is a
              plain, always-available secondary action — clear, not hidden. */}
          <div className="space-y-2.5">
            <button onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-full">
              Keep my {sub.plan === "office" ? "Office" : "Pro"} plan
            </button>
            <button onClick={confirmCancel} disabled={busy !== null}
              className="w-full text-gray-500 hover:text-gray-300 disabled:opacity-50 font-semibold text-xs py-1.5">
              {busy === "cancel" ? "Downgrading…" : "Downgrade to Free anyway"}
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
