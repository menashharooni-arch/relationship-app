"use client";

import { useState } from "react";

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
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { SAMPLE_DATA } from "@/components/card-templates/types";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";

const TEMPLATES = [
  { id: "classic-pro",     label: "Classic Pro",     Component: ClassicPro },
  { id: "modern-bold",     label: "Modern Bold",     Component: ModernBold },
  { id: "photo-first",     label: "Photo First",     Component: PhotoFirst },
  { id: "local-business",  label: "Local Business",  Component: LocalBusiness },
  { id: "luxury-minimal",  label: "Luxury Minimal",  Component: LuxuryMinimal },
];

type Form = {
  username: string; name: string; title: string; company: string;
  email: string; phone: string; website: string; linkedin: string;
  instagram: string; twitter: string; tiktok: string; template: string;
};

const INITIAL: Form = {
  username: "", name: "", title: "", company: "",
  email: "", phone: "", website: "", linkedin: "",
  instagram: "", twitter: "", tiktok: "", template: "classic-pro",
};

export default function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(INITIAL);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    const cleaned = name === "username" ? value.toLowerCase().replace(/[^a-z0-9-]/g, "") : value;
    setForm((prev) => ({ ...prev, [name]: cleaned }));
  }

  async function handleSubmit() {
    setSubmitStatus("loading");
    setError("");
    const { error: insertError } = await supabase.from("profiles").insert({ id: userId, ...form });
    if (insertError) {
      setError(insertError.message.includes("unique") ? "That username is taken. Try another." : insertError.message);
      setSubmitStatus("error");
      setStep(1);
      return;
    }
    fetch("/api/welcome", { method: "POST" }).catch(() => {});
    router.push("/dashboard");
  }

  const previewData = {
    ...SAMPLE_DATA,
    name: form.name || SAMPLE_DATA.name,
    title: form.title || SAMPLE_DATA.title,
    company: form.company || SAMPLE_DATA.company,
    email: form.email || SAMPLE_DATA.email,
    phone: form.phone || SAMPLE_DATA.phone,
  };

  const SelectedTemplate = TEMPLATES.find((t) => t.id === form.template)?.Component ?? ClassicPro;

  const inputCls = "w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm";

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
              style={{
                background: step >= n ? "#2563eb" : "#e5e7eb",
                color: step >= n ? "#fff" : "#9ca3af",
              }}
            >
              {step > n ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : n}
            </div>
            {n < 3 && (
              <div className="flex-1 h-px transition-all" style={{ background: step > n ? "#2563eb" : "#e5e7eb" }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Identity */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">Who are you?</h2>
            <p className="text-gray-500 text-sm mt-1">This goes on your card.</p>
          </div>

          {/* Username */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Your card URL</label>
            <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm focus-within:border-blue-400 transition-colors">
              <span className="text-gray-400 text-sm pl-4 pr-1 shrink-0 whitespace-nowrap">kontact.app/card/</span>
              <input
                name="username"
                placeholder="yourname"
                required
                value={form.username}
                onChange={handle}
                className="flex-1 py-3 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
              />
            </div>
          </div>

          <input name="name"    placeholder="Full name *"                   required value={form.name}    onChange={handle} className={inputCls} />
          <input name="title"   placeholder="Job title (e.g. Founder, Sales Director)" value={form.title}   onChange={handle} className={inputCls} />
          <input name="company" placeholder="Company name"                              value={form.company} onChange={handle} className={inputCls} />

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <button
            onClick={() => { if (!form.username || !form.name) { setError("Name and card URL are required."); return; } setError(""); setStep(2); }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors text-sm mt-2"
          >
            Next: Contact info →
          </button>
        </div>
      )}

      {/* Step 2: Contact info */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">How can people reach you?</h2>
            <p className="text-gray-500 text-sm mt-1">All fields are optional.</p>
          </div>

          <input name="phone"    type="tel"   placeholder="Phone number"          value={form.phone}    onChange={handle} className={inputCls} />
          <input name="email"    type="email" placeholder="Email address"          value={form.email}    onChange={handle} className={inputCls} />
          <input name="website"               placeholder="Website (yoursite.com)" value={form.website}  onChange={handle} className={inputCls} />
          <input
            name="linkedin"
            placeholder="LinkedIn — paste your profile URL"
            value={form.linkedin}
            onChange={handle}
            onBlur={(e) => setForm((p) => ({ ...p, linkedin: parseSocial(e.target.value, "linkedin") }))}
            className={inputCls}
          />

          <div className="h-px bg-gray-100 my-1" />
          <p className="text-xs text-gray-400 font-medium">Social (optional — paste any URL or type @handle)</p>
          <input
            name="instagram"
            placeholder="Instagram"
            value={form.instagram}
            onChange={handle}
            onBlur={(e) => setForm((p) => ({ ...p, instagram: parseSocial(e.target.value, "instagram") }))}
            className={inputCls}
          />
          <input
            name="twitter"
            placeholder="X / Twitter"
            value={form.twitter}
            onChange={handle}
            onBlur={(e) => setForm((p) => ({ ...p, twitter: parseSocial(e.target.value, "twitter") }))}
            className={inputCls}
          />
          <input
            name="tiktok"
            placeholder="TikTok"
            value={form.tiktok}
            onChange={handle}
            onBlur={(e) => setForm((p) => ({ ...p, tiktok: parseSocial(e.target.value, "tiktok") }))}
            className={inputCls}
          />

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-200 text-gray-600 hover:border-gray-400 font-semibold py-3 rounded-full transition-colors text-sm"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-2 flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors text-sm"
            >
              Next: Pick a design →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Pick template */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-gray-900">Pick your card design</h2>
            <p className="text-gray-500 text-sm mt-1">You can change this anytime.</p>
          </div>

          {/* Live preview */}
          <div className="mb-2">
            <SelectedTemplate data={previewData} />
          </div>

          {/* Template selector */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TEMPLATES.map(({ id, label, Component }) => (
              <button
                key={id}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, template: id }))}
                className="text-left rounded-xl overflow-hidden border-2 transition-all"
                style={{
                  borderColor: form.template === id ? "#2563eb" : "#e5e7eb",
                  boxShadow: form.template === id ? "0 0 0 2px #2563eb40" : "none",
                }}
              >
                <div className="w-full pointer-events-none scale-[0.85] origin-top-left" style={{ width: "117%", height: "auto" }}>
                  <Component data={SAMPLE_DATA} />
                </div>
                <p
                  className="text-xs font-semibold text-center py-1.5 truncate"
                  style={{ color: form.template === id ? "#2563eb" : "#6b7280" }}
                >
                  {label}
                </p>
              </button>
            ))}
          </div>

          {submitStatus === "error" && <p className="text-red-500 text-xs text-center">{error}</p>}

          <div className="flex gap-3 mt-1">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-gray-200 text-gray-600 hover:border-gray-400 font-semibold py-3 rounded-full transition-colors text-sm"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitStatus === "loading"}
              className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
            >
              {submitStatus === "loading" ? "Creating your card…" : "Go live now →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
