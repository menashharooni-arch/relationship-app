"use client";

import { useState } from "react";
import { getVisitorId } from "@/lib/visitor";

type Status = "idle" | "loading" | "done" | "error" | "limit";

export default function LeadCaptureForm({
  cardOwner,
  source = "direct_link",
}: {
  cardOwner: string;
  source?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });

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
    } else {
      setStatus(res.ok ? "done" : "error");
    }
  }

  if (status === "done") {
    const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
    // Plain signup — no referrer, no free month. Only a real /r/CODE referral
    // (a friend sharing their link who then upgrades to Pro) grants a free month.
    const signupUrl = `${APP_URL}/join?src=share_info`;

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

        {/* CTA: get their own card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
          <div className="px-5 pt-5 pb-4">
            <p className="text-white font-bold text-sm mb-1">Want your own smart card like this?</p>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              Share your contact in one tap, capture leads automatically, and send follow-ups on autopilot.
              It&apos;s free to start — your card, your way.
            </p>

            {/* Primary CTA */}
            <a
              href={signupUrl}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-center transition-opacity hover:opacity-90 mb-2"
              style={{ background: "#1D4ED8", color: "#fff" }}
            >
              Create a free account →
            </a>

            {/* Download placeholder */}
            <button
              disabled
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-opacity opacity-50 cursor-not-allowed"
              style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155" }}
              title="App coming soon"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 2a8 8 0 100 16A8 8 0 0012 4zm0 3a1 1 0 011 1v4.586l2.293-2.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L11 12.586V8a1 1 0 011-1z"/>
              </svg>
              Download the App — Coming Soon
            </button>
          </div>
          <div className="px-5 py-2.5 border-t" style={{ borderColor: "#1e293b" }}>
            <p className="text-slate-600 text-[10px] text-center">Free to start · No credit card required</p>
          </div>
        </div>
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
