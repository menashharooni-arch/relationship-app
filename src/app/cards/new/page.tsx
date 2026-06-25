"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import type { CardData } from "@/components/card-templates/types";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Turn whatever the user types (a URL, an @handle, or a bare handle) into a clean,
// linkable value so the card can connect to the account automatically.
function normalizeSocial(raw: string, key: SocialKey): string {
  const v = raw.trim();
  if (!v) return "";
  const urlLike = key === "linkedin" || key === "youtube";
  try {
    if (v.includes("://") || v.includes(".")) {
      const url = new URL(v.includes("://") ? v : `https://${v}`);
      const parts = url.pathname.split("/").filter(Boolean);
      if (key === "linkedin") return parts.length ? `linkedin.com/${parts.join("/")}` : v;
      if (key === "youtube") return parts.length ? `youtube.com/${parts.join("/")}` : v;
      const handle = parts[parts.length - 1]?.replace(/^@/, "");
      if (handle) return `@${handle}`;
    }
  } catch {
    /* not a URL — fall through */
  }
  if (urlLike) return v;
  return v.startsWith("@") ? v : `@${v.replace(/^@/, "")}`;
}

type SocialKey = "linkedin" | "youtube" | "instagram" | "tiktok" | "snapchat" | "twitter";

const SOCIALS: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: "linkedin",  label: "LinkedIn",    placeholder: "linkedin.com/in/you" },
  { key: "youtube",   label: "YouTube",     placeholder: "youtube.com/@you" },
  { key: "instagram", label: "Instagram",   placeholder: "@username or profile URL" },
  { key: "tiktok",    label: "TikTok",      placeholder: "@username" },
  { key: "snapchat",  label: "Snapchat",    placeholder: "@username" },
  { key: "twitter",   label: "X (Twitter)", placeholder: "@username" },
];

type Socials = Record<SocialKey, string>;
const EMPTY_SOCIALS: Socials = {
  linkedin: "", youtube: "", instagram: "", tiktok: "", snapchat: "", twitter: "",
};

const TEMPLATES = [
  { id: "classic-pro",    label: "Classic Pro",    Component: ClassicPro },
  { id: "modern-bold",    label: "Modern Bold",    Component: ModernBold },
  { id: "photo-first",    label: "Photo First",    Component: PhotoFirst },
  { id: "local-business", label: "Local Business", Component: LocalBusiness },
  { id: "luxury-minimal", label: "Luxury Minimal", Component: LuxuryMinimal },
];

const inputCls =
  "w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export default function NewCardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — card details
  const [nickname, setNickname] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Step 2 — socials
  const [socials, setSocials] = useState<Socials>(EMPTY_SOCIALS);

  // Step 3 — media + design
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState("classic-pro");

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const username = slugify(nickname);

  function setSocial(key: SocialKey, value: string) {
    setSocials((prev) => ({ ...prev, [key]: value }));
  }
  function normalizeOnBlur(key: SocialKey) {
    setSocials((prev) => ({ ...prev, [key]: normalizeSocial(prev[key], key) }));
  }

  function goNextFrom1() {
    if (!nickname.trim() || !name.trim()) {
      setError("Card nickname and full name are required.");
      return;
    }
    if (!username) {
      setError("Please use letters or numbers in the nickname so we can build a URL.");
      return;
    }
    setError("");
    setStep(2);
  }

  const previewData: CardData = {
    name: name || "Your name",
    title,
    company,
    phone,
    email,
    website: "",
    linkedin: socials.linkedin,
    instagram: socials.instagram,
    twitter: socials.twitter,
    tiktok: socials.tiktok,
    snapchat: socials.snapchat,
    initials: (name || "?")[0]?.toUpperCase() ?? "?",
    photoUrl: headshotUrl,
    logoUrl,
    cardUrl: `swiftcard.me/card/${username || "your-card"}`,
    customization: { snapchat: socials.snapchat },
  };
  const SelectedTemplate = TEMPLATES.find((t) => t.id === template)?.Component ?? ClassicPro;

  async function handleCreate() {
    if (!nickname.trim() || !name.trim() || !username) {
      setStep(1);
      setError("Card nickname and full name are required.");
      return;
    }
    setStatus("loading");
    setError("");

    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        label: nickname.trim(),
        name: name.trim(),
        company: company.trim(),
        title: title.trim(),
        phone: phone.trim(),
        email: email.trim(),
        linkedin: socials.linkedin.trim(),
        instagram: socials.instagram.trim(),
        tiktok: socials.tiktok.trim(),
        twitter: socials.twitter.trim(),
        template,
        logo_url: logoUrl,
        customization: {
          snapchat: socials.snapchat.trim(),
          youtube: socials.youtube.trim(),
        },
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

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors"
                style={{ background: step >= n ? "#2563eb" : "#1f2937", color: step >= n ? "#fff" : "#6b7280" }}
              >
                {n}
              </div>
              {n < 3 && <div className="flex-1 h-px" style={{ background: step > n ? "#2563eb" : "#1f2937" }} />}
            </div>
          ))}
        </div>

        {/* Step 1 — card details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="mb-1">
              <h1 className="text-2xl font-bold text-white">New card</h1>
              <p className="text-gray-400 text-sm mt-1">Start with the basics.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Card nickname <span className="text-red-500">*</span></label>
              <input type="text" placeholder="e.g. Sales Card" value={nickname} onChange={(e) => setNickname(e.target.value)} className={inputCls} />
              <p className="text-gray-600 text-xs mt-1">Card URL: /card/{username || "your-card"}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name <span className="text-red-500">*</span></label>
              <input type="text" placeholder="John Smith" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Company name</label>
              <input type="text" placeholder="Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Job title</label>
              <input type="text" placeholder="Sales Director" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone number</label>
              <input type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input type="email" placeholder="john@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button onClick={goNextFrom1} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors text-sm mt-2">
              Next: Socials →
            </button>
          </div>
        )}

        {/* Step 2 — socials */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="mb-1">
              <h1 className="text-2xl font-bold text-white">Social links</h1>
              <p className="text-gray-400 text-sm mt-1">Optional. Paste a profile URL or type an @handle — we link it automatically.</p>
            </div>

            <div className="space-y-3">
              {SOCIALS.map(({ key, label, placeholder }) => {
                const linked = socials[key].trim().length > 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-gray-500">{label}</label>
                      {linked && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>
                          Linked
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={socials[key]}
                      onChange={(e) => setSocial(key, e.target.value)}
                      onBlur={() => normalizeOnBlur(key)}
                      className={inputCls}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-3 rounded-full transition-colors text-sm">
                ← Back
              </button>
              <button onClick={() => setStep(3)} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors text-sm">
                Next: Logo & design →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — media + design */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="mb-1">
              <h1 className="text-2xl font-bold text-white">Photos & design</h1>
              <p className="text-gray-400 text-sm mt-1">Add your logo and headshot, then pick a design.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Company logo</label>
              <ImageUpload field="logo" currentUrl={logoUrl} label="Upload your company logo" shape="square" defer onUploaded={(url) => setLogoUrl(url)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Headshot</label>
              <ImageUpload field="photo" currentUrl={headshotUrl} label="Upload your headshot" shape="circle" onUploaded={(url) => setHeadshotUrl(url)} />
              <p className="text-[11px] text-gray-600 mt-1">Your headshot is shared across all your cards.</p>
            </div>

            {/* Live preview */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Choose your design</label>
              <div className="rounded-2xl overflow-hidden border border-gray-800 mb-3">
                <SelectedTemplate data={previewData} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemplate(id)}
                    className="text-xs font-semibold py-2 rounded-xl border transition-colors"
                    style={{
                      background: template === id ? "#1D4ED8" : "#111827",
                      borderColor: template === id ? "#1D4ED8" : "#374151",
                      color: template === id ? "#fff" : "#9ca3af",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 mt-1">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-3 rounded-full transition-colors text-sm">
                ← Back
              </button>
              <button
                onClick={handleCreate}
                disabled={status === "loading"}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
              >
                {status === "loading" ? "Creating…" : "Create card →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
