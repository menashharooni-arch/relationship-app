"use client";

import { useState } from "react";

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

// Account Danger Zone: permanent deletion, clearly labeled and secondary-styled.
// Subscription actions (cancel / switch to Free / retention offer) live in the
// Billing section — deletion here is deletion, no retention traps. We still show
// a neutral pointer to Billing so someone who only wants to stop paying knows
// they don't have to delete.
export default function ManageAccount({ isPro, plan = "free" }: { isPro: boolean; plan?: string }) {
  void plan;
  const [advanced, setAdvanced] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState<Step>("survey");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openModal() {
    setStep("survey");
    setReason("");
    setComment("");
    setConfirmText("");
    setError("");
    setModal(true);
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
    if (confirmText.trim().toUpperCase() !== "DELETE") return;
    setLoading(true);
    setError("");
    try {
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
      {/* Deleting an account is irreversible and almost never what someone is
          actually looking for in Settings, so it sits behind two deliberate
          steps (Advanced → Danger Zone) before the modal's survey + typed
          confirmation. Nobody reaches it by accident, and anyone who genuinely
          wants it still gets there in a few clicks. */}
      <button
        type="button"
        onClick={() => setAdvanced((a) => !a)}
        aria-expanded={advanced}
        className="w-full flex items-center justify-between text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Advanced
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 transition-transform ${advanced ? "rotate-90" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {advanced && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2 w-full flex items-center justify-between text-sm font-semibold text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl px-5 py-4 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-red-400/80">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Danger Zone
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {advanced && expanded && (
        <div className="mt-3 bg-gray-900 border border-red-900/40 rounded-2xl p-5">
          <p className="text-white text-sm font-semibold">Delete account</p>
          <p className="text-gray-500 text-xs mt-0.5 mb-3 leading-relaxed">
            Permanently deletes your cards and contacts and cancels any subscription. Your email can&apos;t be used to sign up again.
          </p>
          {isPro && (
            <p className="text-gray-500 text-[11px] mb-3 leading-relaxed">
              Just want to stop paying? You can <a href="#billing" className="text-blue-400 hover:text-blue-300 underline">cancel or switch to Free in Billing</a> and keep your account.
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
                <p className="text-white font-bold text-base mb-1">Delete account?</p>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  This deletes your account, your cards, and <span className="text-white font-semibold">all of your contacts</span>, and cancels any subscription. You&apos;ll have <span className="text-white font-semibold">one month to reopen your account</span> — after that it&apos;s gone for good and can&apos;t be recovered. Your email can&apos;t be used to sign up again.
                </p>
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
                    disabled={loading || confirmText.trim().toUpperCase() !== "DELETE"}
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
