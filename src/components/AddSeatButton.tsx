"use client";

import { useEffect, useState } from "react";
import { useIsNativeApp } from "@/lib/platform";
import { formatUsd } from "@/lib/currency";

// ── Add a seat, from where you actually hit the wall ─────────────────────────
// The invite form disables itself at 0 available seats, and the only way to buy
// one used to be a link out to Settings > Billing — so "add a seat to invite"
// dead-ended on the page that told you to do it. This buys the seat in place.
//
// Buying a seat charges real money immediately (the server sends the increase to
// Stripe with proration_behavior=always_invoice), so this never one-clicks: it
// states the prorated charge and waits for an explicit confirm.

type SeatInfo = {
  seats: number;
  interval: "monthly" | "annual" | null;
  perSeatCents: number | null;
  minSeats: number;
  billable: boolean;
  usage: { purchased: number; active: number; pending: number; used: number; available: number };
};

export default function AddSeatButton({ onAdded }: { onAdded?: () => void }) {
  const native = useIsNativeApp();
  const [info, setInfo] = useState<SeatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore a resolved fetch after unmount, and after a newer one started.
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/stripe/subscription/seats");
        const next = res.ok ? await res.json() : null;
        if (live) setInfo(next);
      } catch {
        if (live) setInfo(null);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  async function addSeat() {
    if (!info) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/subscription/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats: info.seats + 1 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "Couldn't add a seat."); return; }
      // The seat count drives server-rendered numbers all over this page.
      if (onAdded) onAdded(); else window.location.reload();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  // App Store 3.1.1: this is a one-tap in-app seat purchase (price + Stripe
  // charge). Currently unwired, but if it's ever rendered again it must never
  // appear inside the native Capacitor shell. (After all hooks — safe when
  // `native` flips true post-mount.)
  if (native) return null;
  if (loading) return null;

  // No permission (403), or no Stripe subscription behind the office — don't
  // dangle a buy button that can't complete. Billing settings still explains.
  if (!info || !info.billable || info.perSeatCents == null) {
    return (
      <a href="/settings/flows?billing=1#billing" className="underline font-semibold hover:text-amber-500">
        Add a seat in billing →
      </a>
    );
  }

  const per = info.interval === "annual" ? "yr" : "mo";
  const priceLabel = `${formatUsd(info.perSeatCents)}/${per}`;

  if (!confirming) {
    return (
      <button
        onClick={() => { setConfirming(true); setError(null); }}
        className="underline font-semibold hover:text-amber-500"
      >
        Add a seat ({priceLabel}) →
      </button>
    );
  }

  return (
    <span className="block mt-2 rounded-xl border border-[#D4C8B8] bg-[#FAF7F2] p-3 not-italic">
      <span className="block text-slate-900 text-xs font-semibold">
        Add seat {info.seats + 1} for {priceLabel}
      </span>
      <span className="block text-slate-500 text-[11px] mt-0.5 mb-2.5">
        Charged today, prorated for the rest of this billing period. Your {per === "yr" ? "yearly" : "monthly"} total
        becomes {formatUsd(info.perSeatCents * (info.seats + 1))}/{per}.
      </span>
      {error && <span className="block text-red-500 text-[11px] mb-2">{error}</span>}
      <span className="flex gap-2">
        <button
          onClick={addSeat}
          disabled={busy}
          className="bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-colors"
        >
          {busy ? "Adding…" : `Confirm — pay ${priceLabel}`}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={busy}
          className="text-slate-500 hover:text-slate-700 font-medium px-2 py-1.5 text-xs transition-colors"
        >
          Cancel
        </button>
      </span>
    </span>
  );
}
