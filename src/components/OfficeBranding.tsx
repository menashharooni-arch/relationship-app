"use client";

import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";

const TEMPLATES = [
  { id: "classic-pro", label: "Classic Pro" },
  { id: "modern-bold", label: "Modern Bold" },
  { id: "photo-first", label: "Photo First" },
  { id: "local-business", label: "Local Business" },
  { id: "luxury-minimal", label: "Luxury Minimal" },
];

type Brand = {
  brand_logo_url?: string | null;
  brand_company?: string | null;
  brand_website?: string | null;
  brand_template?: string | null;
};

export default function OfficeBranding({ office }: { office: Brand }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(office.brand_logo_url ?? null);
  const [company, setCompany] = useState(office.brand_company ?? "");
  const [website, setWebsite] = useState(office.brand_website ?? "");
  const [template, setTemplate] = useState(office.brand_template ?? "classic-pro");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    if (!logoUrl) { setStatus("error"); return; }
    setStatus("saving");
    try {
      const res = await fetch("/api/office/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl, company, website, template }),
      });
      setStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-6 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Team branding</p>
      <p className="text-slate-500 text-sm mb-5">
        Set the logo, company, website and card design used on <strong>every</strong> card in your office.
        Each member only fills in their own name, title, phone and email.
      </p>

      <div className="space-y-4">
        {/* Logo (mandatory) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Company logo <span className="text-red-500">*</span></label>
          <ImageUpload
            field="logo"
            currentUrl={logoUrl}
            label="Team logo (applied to all cards)"
            shape="square"
            defer
            onUploaded={(url) => setLogoUrl(url || null)}
          />
          {!logoUrl && status === "error" && <p className="text-red-500 text-xs mt-1">A logo is required.</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Company name</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D4ED8]"
              style={{ background: "#fff", border: "1px solid #D4C8B8", color: "#0f172a" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acme.com"
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D4ED8]"
              style={{ background: "#fff", border: "1px solid #D4C8B8", color: "#0f172a" }}
            />
          </div>
        </div>

        {/* Uniform template */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Uniform card design</label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={{
                  background: template === t.id ? "#7c3aed" : "#FAF7F2",
                  color: template === t.id ? "#fff" : "#64748b",
                  border: template === t.id ? "none" : "1px solid #D4C8B8",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={status === "saving"}
            className="text-sm font-semibold text-white px-5 py-2.5 rounded-full disabled:opacity-50"
            style={{ background: "linear-gradient(to right, #7c3aed, #4f46e5)" }}
          >
            {status === "saving" ? "Saving…" : "Save & apply to all cards"}
          </button>
          {status === "saved" && <span className="text-green-600 text-sm font-medium">Applied to every card ✓</span>}
          {status === "error" && logoUrl && <span className="text-red-500 text-sm">Something went wrong.</span>}
        </div>
      </div>
    </div>
  );
}
