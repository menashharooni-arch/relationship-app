"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BASIC_FIELDS = [
  { key: "username", label: "Card URL username", placeholder: "e.g. john-business", hint: "Will be: /card/john-business", required: true },
  { key: "name",     label: "Full name",         placeholder: "John Smith",          required: true },
  { key: "title",    label: "Job title",          placeholder: "Sales Director",      required: false },
  { key: "company",  label: "Company",            placeholder: "Acme Corp",           required: false },
  { key: "phone",    label: "Phone",              placeholder: "+1 (555) 000-0000",   required: false },
  { key: "email",    label: "Email",              placeholder: "john@company.com",    required: false },
  { key: "website",  label: "Website",            placeholder: "www.company.com",     required: false },
];

const SOCIAL_FIELDS = [
  { key: "linkedin",  label: "LinkedIn",    placeholder: "linkedin.com/in/john" },
  { key: "instagram", label: "Instagram",   placeholder: "@john" },
  { key: "twitter",   label: "Twitter / X", placeholder: "@john" },
  { key: "tiktok",    label: "TikTok",      placeholder: "@john" },
  { key: "snapchat",  label: "Snapchat",    placeholder: "@john" },
  { key: "youtube",   label: "YouTube",     placeholder: "youtube.com/@john" },
];

export default function NewCardPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "", name: "", title: "", company: "", phone: "", email: "", website: "",
    linkedin: "", instagram: "", twitter: "", tiktok: "", snapchat: "", youtube: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [showSocials, setShowSocials] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const { snapchat, youtube, ...coreFields } = form;
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...coreFields,
        customization: { snapchat, youtube },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.error === "limit" || data.error === "upgrade") {
        router.push("/pricing");
        return;
      }
      setError(data.error || "Something went wrong.");
      setStatus("error");
      return;
    }

    router.push(`/cards/${data.card.id}/edit`);
  }

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-sm mx-auto">
        <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5 mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">New card</h1>
        <p className="text-gray-400 text-sm mb-8">Create a second card — perfect for different roles or businesses.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {BASIC_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{f.label}</label>
              <input
                type="text"
                placeholder={f.placeholder}
                required={f.required}
                value={form[f.key as keyof typeof form]}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              {f.hint && <p className="text-gray-600 text-xs mt-1">{f.hint}</p>}
            </div>
          ))}

          {/* Socials toggle */}
          <button
            type="button"
            onClick={() => setShowSocials((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:border-blue-600 hover:text-blue-400 text-sm font-medium transition-colors"
          >
            <span>{showSocials ? "Hide social links" : "+ Add social links"}</span>
            <svg className={`w-4 h-4 transition-transform ${showSocials ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSocials && (
            <div className="space-y-4 pl-1 border-l-2 border-gray-800">
              {SOCIAL_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              ))}
            </div>
          )}

          {status === "error" && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm mt-2"
          >
            {status === "loading" ? "Creating…" : "Create card →"}
          </button>
        </form>
      </div>
    </main>
  );
}
