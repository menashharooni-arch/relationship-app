"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const REASONS = [
  "I'm not using it enough",
  "Too expensive",
  "Missing features I need",
  "Found a better alternative",
  "Privacy concerns",
  "Just testing / created by mistake",
  "Other",
];

type Step = "survey" | "confirm";

// Advanced account settings → Account ownership and deletion.
// Deletion is deliberate but never misleading: one clearly-named group, an
// explanation of what's deleted vs. kept, a password re-check when the account
// has one (OAuth-only accounts can't be password-checked), and a typed final
// confirmation. Subscription actions (cancel / switch to Free) live in Billing —
// deletion here is deletion, no retention traps.
export default function ManageAccount({ isPro, plan = "free", email = "" }: { isPro: boolean; plan?: string; email?: string }) {
  void plan;
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState<Step>("survey");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  // null = still checking; false = OAuth-only account (no password to re-check).
  const [needsPassword, setNeedsPassword] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function openModal() {
    setStep("survey");
    setReason("");
    setComment("");
    setConfirmText("");
    setPassword("");
    setError("");
    setModal(true);
    // Reauthentication is only possible when the account has a password
    // identity — a Google-only account has nothing to re-enter.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const hasPassword = !!user?.identities?.some((i) => i.provider === "email");
      setNeedsPassword(hasPassword);
    } catch {
      setNeedsPassword(false);
    }
  }

  function continueFromSurvey() {
    if (!reason) {
      setError("Please pick a reason so we can improve.");
      return;
    }
    setError("");
    setStep("confirm");
  }

  async function finalizeDelete() {
    if (confirmText.trim().toUpperCase() !== "DELETE" || loading) return;
    setLoading(true);
    setError("");
    try {
      // Reauthenticate first when the account supports it, so a borrowed
      // unlocked session can't delete the account.
      if (needsPassword) {
        if (!password) {
          setError("Enter your password to confirm it's you.");
          setLoading(false);
          return;
        }
        const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) {
          setError("That password doesn't match. Please try again.");
          setLoading(false);
          return;
        }
      }
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, comment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't delete the account. Try again.");
        setLoading(false);
        return;
      }
      window.location.href = "/account-deleted";
    } catch {
      setError("Couldn't delete the account. Try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl px-5 py-4 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
          </svg>
          Account ownership and deletion
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 bg-gray-900 border border-red-900/40 rounded-2xl p-5">
          <p className="text-white text-sm font-semibold">Delete account</p>
          <p className="text-gray-500 text-xs mt-0.5 mb-3 leading-relaxed">
            Permanently deletes your cards and contacts and cancels any subscription. Your email can&apos;t be used to sign up again.
          </p>
          {isPro && (
            <p className="text-gray-500 text-[11px] mb-3 leading-relaxed">
              Just want to stop paying? You can <a href="#billing" className="text-blue-400 hover:text-blue-300 underline">cancel or switch to Free in Plan and billing</a> and keep your account.
            </p>
          )}
          <button
            type="button"
            onClick={openModal}
            className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-700 rounded-full px-4 py-2 transition-colors"
          >
            Delete account
          </button>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && !loading && setModal(false)}>
          <div className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-5">
            {step === "survey" && (
              <>
                <p className="text-white font-bold text-base mb-1">Before you go</p>
                <p className="text-gray-500 text-xs mb-4">Help us improve — why are you deleting your account?</p>
                <div className="space-y-1.5 mb-3">
                  {REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
                      <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-blue-600" />
                      {r}
                    </label>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Anything else you'd like us to know? (optional)"
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                />
                {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => setModal(false)} className="flex-1 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-full py-2.5 transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={continueFromSurvey} className="flex-1 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 rounded-full py-2.5 transition-colors">
                    Continue
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <p className="text-white font-bold text-base mb-2">Delete account?</p>
                <div className="text-gray-400 text-sm mb-4 leading-relaxed space-y-2">
                  <p>
                    <span className="text-white font-semibold">Deleted:</span> your account, your cards and their public links, and{" "}
                    <span className="text-white font-semibold">all of your contacts</span>. Any subscription is canceled so you won&apos;t be billed again.
                  </p>
                  <p>
                    <span className="text-white font-semibold">Kept for one month:</span> everything above is held for 30 days so you can reopen your account — after that it&apos;s gone for good and can&apos;t be recovered. Your email can&apos;t be used to sign up again.
                  </p>
                </div>
                {needsPassword && (
                  <>
                    <label className="block text-xs text-gray-500 mb-1.5">Confirm it&apos;s you — enter your password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      autoComplete="current-password"
                      className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 mb-3"
                    />
                  </>
                )}
                <label className="block text-xs text-gray-500 mb-1.5">Type DELETE to confirm</label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 mb-3"
                />
                {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModal(false)} disabled={loading} className="flex-1 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-full py-2.5 transition-colors">
                    Keep my account
                  </button>
                  <button
                    type="button"
                    onClick={finalizeDelete}
                    disabled={loading || confirmText.trim().toUpperCase() !== "DELETE" || (needsPassword === true && !password)}
                    className="flex-1 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-full py-2.5 transition-colors"
                  >
                    {loading ? "Deleting…" : "Delete account"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
