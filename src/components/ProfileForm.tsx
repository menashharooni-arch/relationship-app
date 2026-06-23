"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import ImageUpload from "@/components/ImageUpload";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import { SAMPLE_DATA } from "@/components/card-templates/types";
import type { ComponentType } from "react";
import type { CardData } from "@/components/card-templates/types";

function parseSocial(raw: string, platform: "instagram" | "twitter" | "tiktok" | "linkedin"): string {
  const v = raw.trim();
  if (!v) return "";
  const urlStr = v.includes("://") ? v : `https://${v}`;
  try {
    const url = new URL(urlStr);
    const parts = url.pathname.split("/").filter(Boolean);
    if (platform === "linkedin") {
      if (parts[0] === "in" && parts[1]) return `linkedin.com/in/${parts[1]}`;
      return v;
    }
    const handle = parts[0]?.replace(/^@/, "");
    if (handle) return `@${handle}`;
  } catch { /* not a URL */ }
  if (v.startsWith("@")) return v;
  if (/^[\w.]+$/.test(v) && platform !== "linkedin") return `@${v}`;
  return v;
}

const TEMPLATES: { id: string; label: string; Component: ComponentType<{ data: CardData }> }[] = [
  { id: "classic-pro",    label: "Classic Pro",    Component: ClassicPro },
  { id: "modern-bold",    label: "Modern Bold",    Component: ModernBold },
  { id: "photo-first",    label: "Photo First",    Component: PhotoFirst },
  { id: "local-business", label: "Local Business", Component: LocalBusiness },
  { id: "luxury-minimal", label: "Luxury Minimal", Component: LuxuryMinimal },
];

type Profile = {
  username: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  twitter: string | null;
  tiktok: string | null;
  photo_url: string | null;
  logo_url: string | null;
  template: string | null;
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photo_url);
  const [logoUrl, setLogoUrl] = useState<string | null>(profile.logo_url);
  const [template, setTemplate] = useState(profile.template ?? "classic-pro");
  const [form, setForm] = useState({
    name: profile.name || "",
    title: profile.title || "",
    company: profile.company || "",
    email: profile.email || "",
    phone: profile.phone || "",
    website: profile.website || "",
    linkedin: profile.linkedin || "",
    instagram: profile.instagram || "",
    twitter: profile.twitter || "",
    tiktok: profile.tiktok || "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const { error } = await supabase.from("profiles").update({ ...form, template }).eq("username", profile.username);
    setStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setStatus("idle"), 2000);
  }

  const mainFields = [
    { name: "name", label: "Full name", required: true },
    { name: "title", label: "Job title" },
    { name: "company", label: "Company" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "website", label: "Website" },
    { name: "linkedin", label: "LinkedIn URL" },
  ];

  const socialFields = [
    { name: "instagram", label: "Instagram handle" },
    { name: "twitter", label: "X / Twitter handle" },
    { name: "tiktok", label: "TikTok handle" },
  ];

  const inputCls = "w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-2 shadow-sm">
        <p className="text-xs text-slate-400">Card URL</p>
        <p className="text-blue-600 text-sm">kontact.app/card/{profile.username}</p>
      </div>

      {/* Photo + Logo uploads */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 space-y-4 shadow-sm">
        <p className="text-xs text-slate-500 font-medium">Photos & Logo</p>
        <ImageUpload
          field="photo"
          currentUrl={photoUrl}
          label="Profile photo (shown on Photo card template)"
          shape="circle"
          onUploaded={(url) => setPhotoUrl(url)}
        />
        <ImageUpload
          field="logo"
          currentUrl={logoUrl}
          label="Company logo (shown on all card templates)"
          shape="square"
          onUploaded={(url) => setLogoUrl(url)}
        />
      </div>

      {mainFields.map((f) => (
        <div key={f.name}>
          <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
          <input
            name={f.name}
            type={f.type || "text"}
            required={f.required}
            value={form[f.name as keyof typeof form]}
            onChange={handle}
            className={inputCls}
          />
        </div>
      ))}

      <div className="h-px bg-slate-200 my-2" />
      <p className="text-xs text-slate-500 font-medium">Social links</p>

      {socialFields.map((f) => (
        <div key={f.name}>
          <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
          <input
            name={f.name}
            type="text"
            placeholder={f.name === "linkedin" ? "linkedin.com/in/yourname or paste URL" : "@yourhandle or paste URL"}
            value={form[f.name as keyof typeof form]}
            onChange={handle}
            onBlur={(e) => {
              const platform = f.name as "instagram" | "twitter" | "tiktok" | "linkedin";
              const parsed = parseSocial(e.target.value, platform);
              setForm((prev) => ({ ...prev, [f.name]: parsed }));
            }}
            className={inputCls}
          />
        </div>
      ))}

      {/* Template picker */}
      <div className="h-px bg-slate-200 my-2" />
      <p className="text-xs text-slate-500 font-medium">Card design</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TEMPLATES.map(({ id, label, Component }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTemplate(id)}
            className="text-left rounded-xl overflow-hidden border-2 transition-all"
            style={{
              borderColor: template === id ? "#2563eb" : "#e2e8f0",
              boxShadow: template === id ? "0 0 0 2px #2563eb30" : "none",
            }}
          >
            <div className="w-full pointer-events-none" style={{ transform: "scale(0.85)", transformOrigin: "top left", width: "117%", height: "auto" }}>
              <Component data={SAMPLE_DATA} />
            </div>
            <p
              className="text-xs font-semibold text-center py-1.5 truncate bg-white"
              style={{ color: template === id ? "#2563eb" : "#6b7280", fontSize: 10 }}
            >
              {label}
            </p>
          </button>
        ))}
      </div>

      {status === "error" && <p className="text-red-500 text-xs text-center">Something went wrong.</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
      >
        {status === "loading" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save Changes"}
      </button>
    </form>
  );
}
