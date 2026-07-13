"use client";

import { useEffect, useState } from "react";
import { getVisitorId, getVisitorInfo, hasSharedWith, markSharedWith } from "@/lib/visitor";
import { triggerSignupNudge } from "@/lib/nudge";

type Status = "idle" | "loading" | "done" | "error" | "limit";

export default function LeadCaptureForm({
  cardOwner,
  source = "direct_link",
}: {
  cardOwner: string;
  source?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [alreadyShared, setAlreadyShared] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });

  // If this visitor shared with this owner before, don't ask again — and
  // pre-fill their details in case they use another form on the page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage
    setAlreadyShared(hasSharedWith(cardOwner));
    const v = getVisitorInfo();
    if (v) setForm((prev) => ({ ...prev, name: v.name, phone: v.phone, email: v.email }));
  }, [cardOwner]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setStatus("loading");

    let res: Response;
    try {
      res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          card_owner: cardOwner,
          source,
          visitor_id: getVisitorId(),
        }),
      });
    } catch {
      setStatus("error");
      return;
    }

    if (res.status === 402) {
      setStatus("limit");
    } else if (res.ok) {
      // Remember the share so nothing on this owner's pages asks again.
      markSharedWith(cardOwner, form);
      setStatus("done");
      // Same signup popup as every other "shared their info" moment on the card.
      setTimeout(() => triggerSignupNudge("share_info"), 900);
    } else {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="text-center py-3">
        <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-slate-900 font-bold text-base">Info shared!</p>
      </div>
    );
  }

  // They already shared with this owner — never ask for their info twice.
  if (alreadyShared) {
    return (
      <div className="text-center py-2">
        <p className="text-slate-900 font-semibold text-sm">✓ You&apos;ve already shared your info</p>
        <p className="text-slate-500 text-xs mt-1">They have your details — no need to send them again.</p>
      </div>
    );
  }

  if (status === "limit") {
    return (
      <div className="text-center py-6">
        <p className="text-slate-900 font-semibold">Card at capacity</p>
        <p className="text-slate-500 text-sm mt-1">This person&apos;s card is full. Ask them to upgrade to SwiftCard Pro.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <input
        type="text"
        name="name"
        placeholder="Your name *"
        value={form.name}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <input
        type="tel"
        name="phone"
        placeholder="Your phone number *"
        value={form.phone}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <input
        type="email"
        name="email"
        placeholder="Your email (optional)"
        value={form.email}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <textarea
        name="message"
        placeholder="Quick message (optional)"
        value={form.message}
        onChange={handleChange}
        rows={2}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm resize-none"
      />
      {status === "error" && (
        <p className="text-red-400 text-xs text-center">Something went wrong. Try again.</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-full transition-all text-sm active:scale-[0.98]"
        style={{ background: "#1D4ED8" }}
      >
        {status === "loading" ? "Sending…" : "Share My Info"}
      </button>
      {/* Consent disclosure — kept as small as it can be while still legible;
          TCPA/CTIA only require it to be "clear and conspicuous", so don't go
          below 8px or drop the contrast further. */}
      <p className="text-slate-600 text-[8px] text-center leading-snug">
        By sharing your info you agree to receive follow-up messages by email or text. Reply STOP to a text anytime to opt out.
      </p>
    </form>
  );
}
