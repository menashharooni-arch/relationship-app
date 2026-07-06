"use client";

import { useState } from "react";
import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col">

      {/* Nav */}
      <nav className="border-b border-warm-border bg-cream/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
          <Link href="/">
            <SwiftCardLogo size={30} />
          </Link>
          <div className="flex items-center gap-8">
            <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto w-full px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

        {/* Left: info */}
        <div>
          <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-3">Contact</p>
          <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-5">
            We&apos;d love to hear from you.
          </h1>
          <p className="text-slate-500 text-base leading-relaxed mb-12 max-w-sm">
            Questions about SwiftCard, feedback on the product, or partnership inquiries — drop us a message and we&apos;ll get back to you within 24 hours.
          </p>

          <div className="space-y-6">
            {/* Response time */}
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#E8ECF5", border: "1px solid #C8D4E8" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth={1.5} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-900 font-semibold text-sm">Response time</p>
                <p className="text-slate-500 text-sm mt-0.5">We reply within 24 hours on business days.</p>
              </div>
            </div>

            {/* Based in */}
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#E8ECF5", border: "1px solid #C8D4E8" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth={1.5} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-900 font-semibold text-sm">Based in</p>
                <p className="text-slate-500 text-sm mt-0.5">New York, NY</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-8 shadow-sm">
          {status === "success" ? (
            <div className="py-12 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "#E8ECF5", border: "1px solid #C8D4E8" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth={1.5} className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-slate-900 font-bold text-xl mb-2">Message sent!</h3>
              <p className="text-slate-500 text-sm mb-6">We&apos;ll get back to you within 24 hours.</p>
              <button
                onClick={() => { setStatus("idle"); setForm({ name: "", email: "", message: "" }); }}
                className="text-sm text-brand font-semibold hover:underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-slate-900 font-bold text-lg mb-6">Send us a message</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Your name <span className="text-[#1D4ED8]">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Email address <span className="text-[#1D4ED8]">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Message <span className="text-[#1D4ED8]">*</span></label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder="Tell us how we can help…"
                  className="w-full bg-[#FAF7F2] border border-[#D4C8B8] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors resize-none"
                />
              </div>

              {status === "error" && (
                <p className="text-red-500 text-xs">Something went wrong. Please try again.</p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
              >
                {status === "loading" ? "Sending…" : "Send message →"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Sign in</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
