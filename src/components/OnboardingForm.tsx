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
  { id: "classic-pro",     label: "Classic Pro",     Component: ClassicPro,    tags: ["QR", "Social", "Logo"] },
  { id: "modern-bold",     label: "Modern Bold",     Component: ModernBold,    tags: ["QR", "Social", "Bold"] },
  { id: "photo-first",     label: "Photo First",     Component: PhotoFirst,    tags: ["Photo", "QR", "Social"] },
  { id: "local-business",  label: "Local Business",  Component: LocalBusiness, tags: ["Logo", "QR", "Map"] },
  { id: "luxury-minimal",  label: "Luxury Minimal",  Component: LuxuryMinimal, tags: ["QR", "Minimal", "Gold"] },
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export default function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(INITIAL);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
    setStep(4);
  }

  async function copyUrl() {
    const cardUrl = `${APP_URL}/card/${form.username}`;
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  async function shareCard() {
    const cardUrl = `${APP_URL}/card/${form.username}`;
    const firstName = form.name.split(" ")[0];
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `${firstName}'s SwiftCard`, url: cardUrl });
        return;
      } catch { /* share cancelled */ }
    }
    copyUrl();
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

  const inputCls = "w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors shadow-sm";

  const firstName = form.name.split(" ")[0] || "there";
  const cardUrl = `${APP_URL}/card/${form.username}`;
  const cardUrlDisplay = `swiftcard.me/card/${form.username}`;

  return (
    <div className="w-full">
      {/* Progress bar — hidden on step 4 */}
      {step < 4 && (
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
      )}

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
              <span className="text-gray-400 text-sm pl-4 pr-1 shrink-0 whitespace-nowrap">swiftcard.me/card/</span>
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
            className="w-full bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold py-3 rounded-full transition-colors text-sm mt-2"
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
              className="flex-2 flex-[2] bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold py-3 rounded-full transition-colors text-sm"
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
            {TEMPLATES.map(({ id, label, Component, tags }) => (
              <button
                key={id}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, template: id }))}
                className="text-left rounded-xl overflow-hidden border-2 transition-all"
                style={{
                  borderColor: form.template === id ? "#1D4ED8" : "#e5e7eb",
                  boxShadow: form.template === id ? "0 0 0 2px #1D4ED820" : "none",
                }}
              >
                <div className="w-full pointer-events-none scale-[0.85] origin-top-left" style={{ width: "117%", height: "auto" }}>
                  <Component data={SAMPLE_DATA} />
                </div>
                <div className="bg-white px-2 pt-1.5 pb-2">
                  <p
                    className="text-xs font-semibold text-center truncate"
                    style={{ color: form.template === id ? "#1D4ED8" : "#6b7280", fontSize: 10 }}
                  >
                    {label}
                  </p>
                  <div className="flex flex-wrap gap-1 justify-center mt-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: form.template === id ? "#EBF0FF" : "#f1f5f9",
                          color: form.template === id ? "#1D4ED8" : "#94a3b8",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
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
              className="flex-[2] bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
            >
              {submitStatus === "loading" ? "Creating your card…" : "Go live now →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: You're live! */}
      {step === 4 && (
        <div className="flex flex-col items-center gap-5 animate-pop">
          {/* Success icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #6366f1 100%)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} className="w-9 h-9">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">You&apos;re live, {firstName}!</h2>
            <p className="text-gray-500 text-sm mt-1">Your card is ready to share with the world.</p>
          </div>

          {/* Card URL pill */}
          <div className="w-full rounded-2xl p-4" style={{ background: "#EBF0FF", border: "1px solid #C7D7FF" }}>
            <p className="text-xs font-semibold text-blue-500 mb-1">Your card URL</p>
            <p className="text-sm font-bold text-blue-900 break-all">{cardUrlDisplay}</p>
          </div>

          {/* Copy button */}
          <button
            onClick={copyUrl}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full font-semibold text-sm transition-all active:scale-[0.98]"
            style={{
              background: copied ? "#dcfce7" : "#fff",
              border: copied ? "1.5px solid #86efac" : "1.5px solid #e5e7eb",
              color: copied ? "#16a34a" : "#374151",
            }}
          >
            {copied ? (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Copied!
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy link
              </>
            )}
          </button>

          {/* Share button */}
          <button
            onClick={shareCard}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full font-semibold text-sm transition-all active:scale-[0.98] text-white"
            style={{ background: "#1D4ED8" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share your card
          </button>

          {/* View card link */}
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full font-semibold text-sm transition-all active:scale-[0.98]"
            style={{ background: "#FAF7F2", border: "1px solid #E4DDD4", color: "#475569" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View your card
          </a>

          {/* Dashboard link */}
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-4 mt-1"
          >
            Go to dashboard →
          </button>
        </div>
      )}

      <style>{`
        @keyframes pop {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .animate-pop { animation: pop 0.25s cubic-bezier(0.34,1.56,0.64,1); }
      `}</style>
    </div>
  );
}
