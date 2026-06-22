"use client";

import { useState } from "react";

export default function LeadCaptureForm({ cardOwner }: { cardOwner: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, card_owner: cardOwner }),
    });

    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div className="text-center py-6">
        <p className="text-2xl mb-2">👋</p>
        <p className="text-white font-semibold">Info sent!</p>
        <p className="text-gray-500 text-sm mt-1">They'll be in touch soon.</p>
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
        type="email"
        name="email"
        placeholder="Your email"
        required
        value={form.email}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <input
        type="tel"
        name="phone"
        placeholder="Your phone (optional)"
        value={form.phone}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
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
