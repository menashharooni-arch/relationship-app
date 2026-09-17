"use client";

import { REFERRAL, freeMonthDays } from "@/lib/referral";

const FREE_MONTH_LABEL = `${freeMonthDays(REFERRAL.NEW_USER_FREE_MONTHS)} days`;

/**
 * "A friend gave you a free month of Pro" — the referral gift, offered as a
 * choice on EVERY plan step a new account can reach: /welcome (built the card
 * first) and the card builder's own plan gate (signed up first, then built the
 * card). It used to switch on silently at signup and skip the plan step
 * (owner, 2026-09-17). The server re-checks eligibility when it is pressed.
 */
export default function ReferralGiftPanel({ onStart, busy, starting }: { onStart: () => void; busy: boolean; starting: boolean }) {
  return (
    <div className="max-w-md mx-auto mb-6 rounded-2xl border border-blue-500/40 bg-blue-950/30 px-5 py-4 text-center">
      <p className="text-white font-semibold text-base">🎁 A friend gave you a free month of Pro</p>
      <p className="text-gray-400 text-sm mt-1">Everything in Pro for {FREE_MONTH_LABEL}, no card needed. When it ends you choose Pro or Free, and nothing is charged.</p>
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors text-sm disabled:opacity-50"
      >
        {starting ? "Starting…" : "Start my free month of Pro →"}
      </button>
    </div>
  );
}
