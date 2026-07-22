"use client";

import { useState } from "react";
import SmsConsentCheckbox from "@/components/SmsConsentCheckbox";
import { triggerSignupNudge } from "@/lib/nudge";
import { getVisitorInfo, markSharedWith } from "@/lib/visitor";

export default function ConnectButton({
  cardOwner,
  ownerFirstName,
}: {
  cardOwner: string;
  ownerFirstName: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  // True when we already know who the visitor is (they shared with this owner
  // before) — we collapse the contact fields so they're never asked twice.
  const [knownInfo, setKnownInfo] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false); // affirmative opt-in — never pre-checked
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  function openModal() {
    const v = getVisitorInfo();
    setForm({ name: v?.name ?? "", phone: v?.phone ?? "", email: v?.email ?? "", message: "" });
    // Collapse the contact fields whenever we already know this visitor — even
    // if they shared with a DIFFERENT owner before. Once someone has shared
    // their info anywhere, no SwiftLink re-asks for it; they just add a message
    // and send. (hasSharedWith stays imported for back-compat callers.)
    setKnownInfo(!!v);
    setSmsConsent(false); // reset the opt-in each open — never carry a prior check forward
    setStatus("idle");
    setError("");
    setOpen(true);
  }

  // Whatever way the modal closes — X, backdrop, or Done after sending — the
  // visitor gets the join-for-free invite (the host shows it once per session).
  function closeModal() {
    setOpen(false);
    triggerSignupNudge("share_info");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          message: form.message.trim() || null,
          card_owner: cardOwner,
          source: "swift_connect",
          sms_consent: smsConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Couldn't send your message. Try again.");
        setStatus("error");
        return;
      }
      markSharedWith(cardOwner, form);
      setStatus("done");
      // Sent successfully → briefly show the confirmation, then auto-surface the
      // "Create your free account" invite (same as the exit path). No extra tap.
      setTimeout(() => closeModal(), 1400);
    } catch {
      setError("Couldn't send your message. Try again.");
      setStatus("error");
    }
  }

  const inputCls =
    "w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-white shadow-sm transition-all active:scale-[0.98]"
        style={{ background: "#1D4ED8" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Connect with {ownerFirstName}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6" style={{ background: "#FAF7F2", border: "1px solid #E4DDD4" }}>
            {status === "done" ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-slate-900 font-bold text-base">Info shared!</p>
                <button type="button" onClick={closeModal} className="mt-5 w-full font-semibold py-3 rounded-full text-white text-sm" style={{ background: "#1D4ED8" }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-slate-900 font-bold text-base leading-snug">Reach out to {ownerFirstName}</p>
                    <p className="text-slate-500 text-sm mt-1">
                      {knownInfo ? "Just type your message — we've got your details." : "Send your details and a quick message."}
                    </p>
                  </div>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-2xl leading-none ml-3" aria-label="Close">×</button>
                </div>
                <form onSubmit={submit} className="space-y-3">
                  {knownInfo ? (
                    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                      <p className="text-gray-700 text-sm truncate">
                        Sending as <span className="font-semibold text-gray-900">{form.name}</span>
                        <span className="text-gray-400"> · {form.phone}</span>
                      </p>
                      <button type="button" onClick={() => setKnownInfo(false)} className="text-blue-600 text-xs font-semibold shrink-0 ml-3">
                        Edit
                      </button>
                    </div>
                  ) : (
                    <>
                      <input type="text" placeholder="Your name *" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
                      <input type="tel" placeholder="Your phone *" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
                      <input type="email" placeholder="Your email (optional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
                    </>
                  )}
                  <textarea rows={3} placeholder={`Message for ${ownerFirstName}…`} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className={`${inputCls} resize-none`} />
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                  {/* SMS consent — separate affirmative opt-in (unchecked by
                      default, optional); same block as every capture surface. */}
                  <SmsConsentCheckbox checked={smsConsent} onChange={setSmsConsent} />
                  <button type="submit" disabled={status === "loading"} className="w-full font-bold py-3 rounded-full text-white text-sm disabled:opacity-50" style={{ background: "#1D4ED8" }}>
                    {status === "loading" ? "Sending…" : "Send message"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
