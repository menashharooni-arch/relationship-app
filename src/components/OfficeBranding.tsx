"use client";

import { useState } from "react";
import CardScaler from "@/components/CardScaler";
import InertPreview from "@/components/InertPreview";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import { withoutSocials } from "@/components/card-templates/types";

// Dark-theme form matching the /office/admin shell (bg-gray-900 panels, purple
// accent), organised into the three questions an owner actually has:
//   1. Company information — what's true about the business
//   2. Card appearance     — what it looks like
//   3. What team members can edit — where their control ends
// Plus a live preview, so "every card uses this" is something they can see
// rather than something they have to take on faith.

const TEMPLATES = [
  { id: "classic-pro", label: "Classic Pro" },
  { id: "modern-bold", label: "Modern Bold" },
  { id: "photo-first", label: "Photo First" },
  { id: "local-business", label: "Local Business" },
  { id: "luxury-minimal", label: "Luxury Minimal" },
] as const;

const TEMPLATE_COMPONENTS = {
  "classic-pro": ClassicPro,
  "modern-bold": ModernBold,
  "photo-first": PhotoFirst,
  "local-business": LocalBusiness,
  "luxury-minimal": LuxuryMinimal,
} as const;

type TemplateId = keyof typeof TEMPLATE_COMPONENTS;
const isTemplateId = (v: string): v is TemplateId => v in TEMPLATE_COMPONENTS;

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

function Section({ n, title, desc, children }: {
  n: number; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-5 h-5 rounded-full bg-purple-500/15 text-purple-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
          {n}
        </span>
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function OfficeBranding({ office }: { office: Brand }) {
  // Company identity + look are READ-ONLY here — they come from the Primary Card
  // (edit them there). This page manages only the office-only contact fields and
  // the template lock. No setters for the inherited values.
  const logoUrl = office.brand_logo_url ?? null;
  const company = office.brand_company ?? "";
  const website = office.brand_website ?? "";
  const template = office.brand_template ?? "classic-pro";
  const [phone, setPhone] = useState(office.brand_phone ?? "");
  const [fax, setFax] = useState(office.brand_fax ?? "");
  const [address, setAddress] = useState<Addr>(office.brand_address ?? {});
  const [lockTemplate, setLockTemplate] = useState(office.brand_locks?.template !== false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const setAddr = (k: keyof Addr, v: string) => setAddress((a) => ({ ...a, [k]: v }));

  async function save() {
    if (status === "saving") return;
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

  // Live preview — a stand-in teammate, so the owner sees the company half
  // exactly as it will appear on every card, filled around placeholder personal
  // details they don't control.
  const Preview = TEMPLATE_COMPONENTS[isTemplateId(template) ? template : "classic-pro"];
  const addrLine = [address.street, address.unit, address.city, address.state, address.zip]
    .filter((v) => (v ?? "").toString().trim()).join(", ");
  const previewData = withoutSocials({
    name: "Dana Lee",
    title: "Sales Manager",
    company: company || "Your company",
    phone: phone || "(415) 555-0188",
    email: "dana@" + (website ? website.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "company.com"),
    website: website || "",
    address: addrLine || undefined,
    initials: "DL",
    logoUrl,
    cardUrl: "swiftcard.me/card/dana",
  });

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        {/* 1 ── Company information ─────────────────────────────────────── */}
        <Section n={1} title="Company information" desc="What's true about your business. This is the same on everyone's card.">
          <div className="space-y-4">
            {/* Logo / company / website are INHERITED from the Primary Card
                (read-only here — change them on your card, which re-brands the
                whole team). Only the office-only contact fields below are edited
                on this page. */}
            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Company logo" className="w-12 h-12 rounded-lg object-cover bg-gray-900 shrink-0" />
                ) : (
                  <span className="w-12 h-12 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600 text-[10px] shrink-0">No logo</span>
                )}
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{company || "Set your company name on your card"}</p>
                  <p className="text-gray-500 text-xs truncate">{website || "No website yet"}</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-2.5">
                Logo, company name, website and card design come from your <span className="text-gray-300 font-medium">Primary Card</span>. Edit your card (link above) to change them for the whole team.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Main phone number <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className={inputCls} />
                <p className="text-[11px] text-gray-600 mt-1">Shows as &quot;Office&quot; on every card, next to each person&apos;s own number.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Fax <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <input type="tel" value={fax} onChange={(e) => setFax(e.target.value)} placeholder="(555) 123-4568" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Business address <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              <div className="grid grid-cols-6 gap-2">
                <input value={address.street ?? ""} onChange={(e) => setAddr("street", e.target.value)} placeholder="Street" aria-label="Street" className={`col-span-4 ${inputCls}`} />
                <input value={address.unit ?? ""} onChange={(e) => setAddr("unit", e.target.value)} placeholder="Unit" aria-label="Unit" className={`col-span-2 ${inputCls}`} />
                <input value={address.city ?? ""} onChange={(e) => setAddr("city", e.target.value)} placeholder="City" aria-label="City" className={`col-span-3 ${inputCls}`} />
                <input value={address.state ?? ""} onChange={(e) => setAddr("state", e.target.value)} placeholder="State" aria-label="State" className={`col-span-1 ${inputCls}`} />
                <input value={address.zip ?? ""} onChange={(e) => setAddr("zip", e.target.value)} placeholder="ZIP" aria-label="ZIP" className={`col-span-2 ${inputCls}`} />
              </div>
            </div>
          </div>
        </Section>

        {/* 2 ── Card appearance ─────────────────────────────────────────── */}
        <Section n={2} title="Card appearance" desc="The design your whole team inherits — set on your Primary Card.">
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <span
                key={t.id}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  template === t.id
                    ? "bg-purple-600/20 text-purple-200 border border-purple-500/40"
                    : "bg-gray-950 text-gray-600 border border-gray-800"
                }`}
              >
                {t.label}{template === t.id ? " ✓" : ""}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-3">
            The template, colors and fonts come from your <span className="text-gray-400 font-medium">Primary Card</span> — change your card once and everyone&apos;s updates with it. Use the lock below to decide whether the team&apos;s cards must match it.
          </p>
        </Section>

        {/* 3 ── What team members can edit ──────────────────────────────── */}
        <Section n={3} title="What team members can edit" desc="Everything else is locked to what you set above.">
          <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3.5 mb-4">
            <p className="text-[11px] font-semibold text-gray-400 mb-2">Each person fills in only:</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {["Their name", "Their photo", "Their job title", "Their phone", "Their email"].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span className="text-green-400" aria-hidden="true">✓</span>{t}
                </li>
              ))}
            </ul>
            <p className="text-[11px] font-semibold text-gray-400 mt-3 mb-2">They can never change:</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {["Company logo", "Company name", "Website", "Office phone", "Address"].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="text-gray-600" aria-hidden="true">🔒</span>{t}
                </li>
              ))}
            </ul>
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
        </Section>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={status === "saving"}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save & apply to all cards"}
          </button>
          {status === "saved" && <span className="text-green-400 text-sm font-medium" role="status">Applied to every card ✓</span>}
          {status === "error" && logoUrl && (
            <span className="text-red-400 text-sm" role="alert">Something went wrong — please try again.</span>
          )}
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-24">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</p>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3">
          <div className="rounded-xl overflow-hidden">
            <InertPreview><CardScaler><Preview data={previewData} /></CardScaler></InertPreview>
          </div>
          <p className="text-[11px] text-gray-600 mt-2.5 leading-snug">
            An example teammate. Their name, photo, title, phone and email are theirs — everything else is what you set here.
          </p>
        </div>
      </aside>
    </div>
  );
}
