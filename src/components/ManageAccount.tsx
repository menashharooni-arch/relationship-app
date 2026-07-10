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

type Step = "survey" | "retain" | "confirm" | "done";

export default function ManageAccount({ isPro }: { isPro: boolean }) {
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
    setStep(isPro ? "retain" : "confirm");
  }

  async function stayWithOffer() {
    setLoading(true);
    try {
      const res = await fetch("/api/account/retain", { method: "POST" });
      if (!res.ok) throw new Error("retain failed");
      setStep("done");
    } catch {
      setError("Something went wrong applying your offer — please try again.");
    }
    setLoading(false);
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
      // Session ended server-side — go to the deleted page (full reload).
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
        className="w-full flex items-center justify-between text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl px-5 py-4 transition-colors"
      >
        Manage account
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-white text-sm font-medium">Delete account</p>
          <p className="text-gray-500 text-xs mt-0.5 mb-3 leading-relaxed">
            Permanently deletes your cards and contacts and cancels any subscription. Your email can&apos;t be used to sign up again.
          </p>
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

            {step === "retain" && (
              <>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-600/15 border border-blue-600/30 flex items-center justify-center mx-auto mb-3 text-2xl">🎁</div>
                  <p className="text-white font-bold text-base mb-1">Wait — here&apos;s a month on us</p>
                  <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                    We&apos;d hate to see you go. Stay and your next month of Pro is <span className="text-white font-semibold">free</span>.
                  </p>
                </div>
                <button type="button" onClick={stayWithOffer} disabled={loading} className="w-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-full py-3 transition-colors mb-2">
                  {loading ? "…" : "Keep my account & get 1 month free"}
                </button>
                <button type="button" onClick={() => setStep("confirm")} className="w-full text-xs text-gray-500 hover:text-gray-300 py-1.5 transition-colors">
                  No thanks, continue deleting
                </button>
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
                    Cancel
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

            {step === "done" && (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-green-600/15 border border-green-600/30 flex items-center justify-center mx-auto mb-3 text-2xl">🎉</div>
                <p className="text-white font-bold text-base mb-1">Glad you&apos;re staying!</p>
                <p className="text-gray-400 text-sm mb-5">Your free month has been applied to your account.</p>
                <button type="button" onClick={() => setModal(false)} className="w-full text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 rounded-full py-2.5 transition-colors">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
