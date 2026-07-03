"use client";

import { useEffect, useState } from "react";
import { getVisitorId, getVisitorInfo, hasSharedWith, markSharedWith } from "@/lib/visitor";

type Status = "idle" | "loading" | "done" | "error" | "limit";

// The post-share sales moment: a rich "make your own card" panel whose button
// lands on the Test It Live demo (/join?to=live → /preview), not a signup form.
function CreateCardCTA() {
  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
  const signupUrl = `${APP_URL}/join?src=share_info&to=live`;

  return (
    <div className="rounded-3xl p-[1.5px] bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 shadow-[0_10px_40px_rgba(79,70,229,0.35)]">
      <div className="rounded-[calc(1.5rem-1.5px)] px-5 pt-5 pb-4" style={{ background: "#0B1120" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-lg leading-none">✨</span>
          <p className="text-white font-extrabold text-[15px]">Want a smart card like this?</p>
        </div>
        <p className="text-slate-400 text-xs leading-relaxed mb-4">
          Share your contact in one tap, capture every lead, and follow up on autopilot.
          Try it live right now — no signup needed.
        </p>
        <a
          href={signupUrl}
          className="flex items-center justify-center gap-1.5 w-full py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 transition-colors shadow-lg shadow-blue-900/40"
        >
          Create Your Free Card →
        </a>
        <p className="text-slate-500 text-[10px] text-center mt-2.5">
          Free to start · No credit card · See a live demo first
        </p>
      </div>
    </div>
  );
}

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
    setAlreadyShared(hasSharedWith(cardOwner));
    const v = getVisitorInfo();
    if (v) setForm((prev) => ({ ...prev, name: v.name, phone: v.phone, email: v.email }));
  }, [cardOwner]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        card_owner: cardOwner,
        source,
        visitor_id: getVisitorId(),
      }),
    });

    if (res.status === 402) {
      setStatus("limit");
    } else if (res.ok) {
      // Remember the share so nothing on this owner's pages asks again.
      markSharedWith(cardOwner, form);
      setStatus("done");
    } else {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="space-y-4">
        {/* Success confirmation */}
        <div className="text-center py-3">
          <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-slate-900 font-bold text-base">Info shared!</p>
          <p className="text-slate-500 text-sm mt-1">They&apos;ll be in touch soon.</p>
        </div>

        <CreateCardCTA />
      </div>
    );
  }

  // They already shared with this owner — never ask for their info twice.
  if (alreadyShared) {
    return (
      <div className="space-y-4">
        <div className="text-center py-2">
          <p className="text-slate-900 font-semibold text-sm">✓ You&apos;ve already shared your info</p>
          <p className="text-slate-500 text-xs mt-1">They have your details — no need to send them again.</p>
        </div>
        <CreateCardCTA />
      </div>
    );
  }

  if (status === "limit") {
    return (
      <div className="text-center py-6">
        <p className="text-2xl mb-2">📨</p>
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
        required
        value={form.name}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <input
        type="tel"
        name="phone"
        placeholder="Your phone number *"
        required
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
