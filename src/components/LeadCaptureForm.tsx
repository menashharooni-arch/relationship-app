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
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", message: "" });

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
    const signupUrl = `${APP_URL}/login?mode=signup&ref=${encodeURIComponent(cardOwner)}`;
    return (
      <div className="space-y-4">
        {/* Confirmation */}
        <div className="text-center py-3">
          <div className="w-10 h-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-slate-900 font-semibold">Info sent!</p>
          <p className="text-slate-500 text-sm mt-1">You'll hear from them soon.</p>
        </div>

        {/* SwiftCard viral CTA */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#0f172a", border: "1px solid #1e293b" }}
        >
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-white font-bold text-sm">Get your own card like this</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              Share your contact in one tap. Never lose a lead. Automated follow-ups on autopilot — free to start.
            </p>
            <div className="flex items-center gap-3 mb-4">
              {[
                { icon: "⚡", label: "60-second setup" },
                { icon: "📊", label: "Lead dashboard" },
                { icon: "🤖", label: "Auto follow-ups" },
              ].map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-base">{f.icon}</span>
                  <span className="text-gray-500 text-[9px] text-center leading-tight">{f.label}</span>
                </div>
              ))}
            </div>
            <a
              href={signupUrl}
              className="block w-full py-3 rounded-xl text-sm font-bold text-center transition-opacity hover:opacity-90"
              style={{ background: "#1D4ED8", color: "#fff" }}
            >
              Create your free card →
            </a>
          </div>
          <div className="px-5 py-2.5 border-t" style={{ borderColor: "#1e293b" }}>
            <p className="text-gray-600 text-[10px] text-center">Trusted by 12,000+ professionals · Free forever</p>
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
        <p className="text-slate-500 text-sm mt-1">This person's card is full. Ask them to upgrade to SwiftCard Pro.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <input
        type="text"
        name="name"
        placeholder="Your name"
        required
        value={form.name}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <input
        type="tel"
        name="phone"
        placeholder="Your phone number"
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
      <input
        type="text"
        name="company"
        placeholder="Your company (optional)"
        value={form.company}
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
        className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm"
      >
        {status === "loading" ? "Sending…" : "Share My Info"}
      </button>
    </form>
  );
}
