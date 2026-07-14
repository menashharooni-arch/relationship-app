"use client";

import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";

// Dark-theme form matching the /office/admin shell (bg-gray-900 panels, purple
// accent). This used to be a cream/light panel sitting on the dark admin — the
// one place the admin looked broken — so it now uses the same tokens as every
// other admin surface. Copy is written for an owner, not a designer.

const TEMPLATES = [
  { id: "classic-pro", label: "Classic Pro" },
  { id: "modern-bold", label: "Modern Bold" },
  { id: "photo-first", label: "Photo First" },
  { id: "local-business", label: "Local Business" },
  { id: "luxury-minimal", label: "Luxury Minimal" },
];

type Addr = { street?: string; unit?: string; city?: string; state?: string; zip?: string };
type Brand = {
  brand_logo_url?: string | null;
  brand_company?: string | null;
  brand_website?: string | null;
  brand_template?: string | null;
  brand_phone?: string | null;
  brand_fax?: string | null;
  brand_address?: Addr | null;
  brand_locks?: { template?: boolean } | null;
};

const inputCls =
  "w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40";

export default function OfficeBranding({ office }: { office: Brand }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(office.brand_logo_url ?? null);
  const [company, setCompany] = useState(office.brand_company ?? "");
  const [website, setWebsite] = useState(office.brand_website ?? "");
  const [template, setTemplate] = useState(office.brand_template ?? "classic-pro");
  const [phone, setPhone] = useState(office.brand_phone ?? "");
  const [fax, setFax] = useState(office.brand_fax ?? "");
  const [address, setAddress] = useState<Addr>(office.brand_address ?? {});
  const [lockTemplate, setLockTemplate] = useState(office.brand_locks?.template !== false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const setAddr = (k: keyof Addr, v: string) => setAddress((a) => ({ ...a, [k]: v }));

  async function save() {
    if (!logoUrl) { setStatus("error"); return; }
    setStatus("saving");
    try {
      const res = await fetch("/api/office/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl, company, website, template, phone, fax, address, lockTemplate }),
      });
      setStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6">
      <p className="text-sm font-semibold text-white mb-1">Company details</p>
      <p className="text-gray-500 text-xs mb-5">
        These appear on <strong className="text-gray-400">every</strong> card on your team.
        Each person only fills in their own name, photo, title, phone and email.
      </p>

      <div className="space-y-5">
        {/* Logo (mandatory) */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Company logo <span className="text-red-400">*</span>
          </label>
          <ImageUpload
            field="logo"
            currentUrl={logoUrl}
            label="Company logo (shows on every card)"
            shape="square"
            defer
            onUploaded={(url) => setLogoUrl(url || null)}
          />
          {!logoUrl && status === "error" && (
            <p className="text-red-400 text-xs mt-1">Add your logo first — it&apos;s what makes the cards yours.</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Company name</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Plumbing" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Website</label>
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
              placeholder="acmeplumbing.com" className={inputCls} />
          </div>
        </div>

        {/* Company contact (uniform, employees can't edit) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Main phone number <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567" className={inputCls} />
            <p className="text-[11px] text-gray-600 mt-1">Shows as &quot;Office&quot; on every card, next to each person&apos;s own number.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Fax <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input type="tel" value={fax} onChange={(e) => setFax(e.target.value)}
              placeholder="(555) 123-4568" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Business address <span className="text-gray-600 font-normal">(optional)</span>
          </label>
          <div className="grid grid-cols-6 gap-2">
            <input value={address.street ?? ""} onChange={(e) => setAddr("street", e.target.value)} placeholder="Street" className={`col-span-4 ${inputCls}`} />
            <input value={address.unit ?? ""} onChange={(e) => setAddr("unit", e.target.value)} placeholder="Unit" className={`col-span-2 ${inputCls}`} />
            <input value={address.city ?? ""} onChange={(e) => setAddr("city", e.target.value)} placeholder="City" className={`col-span-3 ${inputCls}`} />
            <input value={address.state ?? ""} onChange={(e) => setAddr("state", e.target.value)} placeholder="State" className={`col-span-1 ${inputCls}`} />
            <input value={address.zip ?? ""} onChange={(e) => setAddr("zip", e.target.value)} placeholder="ZIP" className={`col-span-2 ${inputCls}`} />
          </div>
        </div>

        {/* Uniform template + lock */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Card style</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  template === t.id
                    ? "bg-purple-600 text-white"
                    : "bg-gray-950 text-gray-400 border border-gray-800 hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={lockTemplate}
              onChange={(e) => setLockTemplate(e.target.checked)}
              className="accent-purple-500 mt-0.5"
            />
            <span>
              Keep every card matching
              <span className="block text-[11px] text-gray-600 mt-0.5">
                Recommended. Uncheck only if you want each person to pick their own style.
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <button
            onClick={save}
            disabled={status === "saving"}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save & apply to all cards"}
          </button>
          {status === "saved" && <span className="text-green-400 text-sm font-medium">Applied to every card ✓</span>}
          {status === "error" && logoUrl && (
            <span className="text-red-400 text-sm">Something went wrong — please try again.</span>
          )}
        </div>
      </div>
    </div>
  );
}
