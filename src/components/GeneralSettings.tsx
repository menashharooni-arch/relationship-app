"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ManageBillingButton from "./ManageBillingButton";

type Props = {
  email: string;
  cardCount: number;
  plan: string;
  isPro: boolean;
  defaultOpen?: boolean;
};

export default function GeneralSettings({ email, cardCount, plan, isPro, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const planLabel = plan === "enterprise" ? "Office" : isPro ? "Pro" : "Free";
  const ref = useRef<HTMLDivElement>(null);

  // Downgrade (individual Pro only — Office manages seats via the billing portal).
  const canDowngrade = plan === "pro";
  const [confirmingDowngrade, setConfirmingDowngrade] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [downgradeError, setDowngradeError] = useState("");

  // Deep-linked from a receipt email (?billing=1) → open and scroll into view.
  useEffect(() => {
    if (defaultOpen) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [defaultOpen]);

  async function downgradeToFree() {
    setDowngrading(true);
    setDowngradeError("");
    try {
      const res = await fetch("/api/account/downgrade", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDowngradeError(data.error || "Couldn't switch to Free — please try again.");
        setDowngrading(false);
        return;
      }
      window.location.reload();
    } catch {
      setDowngradeError("Couldn't switch to Free — please try again.");
      setDowngrading(false);
    }
  }

  return (
    <div ref={ref} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-900/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-5 h-5 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold">General</p>
            <p className="text-gray-500 text-xs truncate">Account, plan &amp; billing</p>
          </div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-800">
          {/* Account info */}
          <div className="pt-4">
            <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-2">Account</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 text-xs shrink-0">Email</span>
                <span className="text-white text-xs font-medium truncate">{email}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 text-xs shrink-0">Cards</span>
                <span className="text-white text-xs font-medium truncate">{cardCount} card{cardCount === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-800" />

          {/* Subscription & payment */}
          <div>
            <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-2">Subscription</p>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-gray-500 text-xs">Current plan</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${plan === "enterprise" ? "bg-purple-600 text-white" : isPro ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                {planLabel}
              </span>
            </div>
            {isPro ? (
              <ManageBillingButton />
            ) : (
              <Link href="/pricing" className="block text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full py-2.5 transition-colors">
                Upgrade to Pro →
              </Link>
            )}
            <p className="text-gray-600 text-[11px] mt-2 leading-relaxed">
              {isPro
                ? "Update your payment method, view invoices (card ending shown there), or cancel anytime in the billing portal."
                : "Pro unlocks unlimited cards, analytics, custom card design, and removes SwiftCard branding."}
            </p>

            {/* Change plan — a one-tap downgrade to Free, so people don't have to
                cancel through the portal or the delete flow. Office manages seats
                via the portal, so it's only offered for individual Pro. */}
            {canDowngrade && (
              <div className="mt-3 pt-3 border-t border-gray-800/70">
                <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-2">Change plan</p>
                {confirmingDowngrade ? (
                  <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-gray-300 text-xs leading-relaxed mb-2.5">
                      Switch to Free? Your Pro billing stops now and your account, cards, and contacts stay. You can upgrade again anytime.
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmingDowngrade(false)} disabled={downgrading}
                        className="flex-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full py-2 transition-colors disabled:opacity-50">
                        Keep Pro
                      </button>
                      <button type="button" onClick={downgradeToFree} disabled={downgrading}
                        className="flex-1 text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full py-2 transition-colors disabled:opacity-50">
                        {downgrading ? "Switching…" : "Switch to Free"}
                      </button>
                    </div>
                    {downgradeError && <p className="text-red-400 text-[11px] mt-2">{downgradeError}</p>}
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmingDowngrade(true)}
                    className="w-full text-center text-xs font-medium text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-full py-2.5 transition-colors">
                    Downgrade to Free
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
