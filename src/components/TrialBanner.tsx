"use client";

import Link from "next/link";
import { useIsNativeApp } from "@/lib/platform";

// Dashboard banner shown while an account is on an app-level Pro grant (the
// 14-day reverse trial, or a stacked referral/free month). Presentational only —
// the dashboard decides when to render it and passes the computed days left.
//
// NATIVE (App Store 3.1.1): the status line is neutral information and stays,
// but the "Keep Pro →" /pricing CTA is a selling surface and must never render
// inside the Capacitor shell. Web is byte-identical (native is false on SSR and
// first paint).
//
// `converts`: a CARD-BACKED trial (Stripe) in its last days. Nothing moves to
// Free — Pro simply continues on their card — so the copy says that, and the
// link goes to billing (where they can see the charge or cancel), not to an
// upgrade they have already made.
export default function TrialBanner({ daysLeft, isTrial, converts = false }: { daysLeft: number; isTrial: boolean; converts?: boolean }) {
  const native = useIsNativeApp();
  const urgent = daysLeft <= 3;
  const label = isTrial ? "You're on a free Pro trial" : "You're on free Pro";
  const days = daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;

  if (converts) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5 mb-5 border flex-wrap"
        style={{ background: "rgba(37,99,235,0.10)", borderColor: "rgba(37,99,235,0.35)" }}
      >
        <p className="text-sm font-medium text-blue-200 min-w-0">
          Your Pro trial ends in <span className="font-bold">{daysLeft === 1 ? "1 day" : `${daysLeft} days`}</span>
          <span className="hidden sm:inline text-gray-400 font-normal"> · then Pro continues without a break.</span>
        </p>
        {!native && (
          <Link
            href="/settings/flows?billing=1#billing"
            className="shrink-0 text-xs font-bold px-4 py-2 rounded-full text-white transition-colors bg-blue-600 hover:bg-blue-500"
          >
            Plan and billing
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5 mb-5 border flex-wrap"
      style={
        urgent
          ? { background: "rgba(180,83,9,0.12)", borderColor: "rgba(180,83,9,0.4)" }
          : { background: "rgba(37,99,235,0.10)", borderColor: "rgba(37,99,235,0.35)" }
      }
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <p className={`text-sm font-medium ${urgent ? "text-amber-300" : "text-blue-200"}`}>
          {label} — <span className="font-bold">{days}</span>
          <span className="hidden sm:inline text-gray-400 font-normal">
            {" "}· then you move to Free. Nothing gets deleted.
          </span>
        </p>
      </div>
      {!native && (
        <Link
          href="/upgrade"
          className={`shrink-0 text-xs font-bold px-4 py-2 rounded-full text-white transition-colors ${
            urgent ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"
          }`}
        >
          Keep Pro →
        </Link>
      )}
    </div>
  );
}
