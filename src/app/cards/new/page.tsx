"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";

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
    /* not a URL — fall through to handle parsing */
  }
  if (urlLike) return v;
  return v.startsWith("@") ? v : `@${v.replace(/^@/, "")}`;
}

type SocialKey = "instagram" | "snapchat" | "linkedin" | "tiktok" | "youtube" | "twitter";

const SOCIALS: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", placeholder: "@username or profile URL" },
  { key: "snapchat",  label: "Snapchat",  placeholder: "@username" },
  { key: "linkedin",  label: "LinkedIn",  placeholder: "linkedin.com/in/you" },
  { key: "tiktok",    label: "TikTok",    placeholder: "@username" },
  { key: "youtube",   label: "YouTube",   placeholder: "youtube.com/@you" },
  { key: "twitter",   label: "X (Twitter)", placeholder: "@username" },
];

type Socials = Record<SocialKey, string>;
const EMPTY_SOCIALS: Socials = {
  instagram: "", snapchat: "", linkedin: "", tiktok: "", youtube: "", twitter: "",
};

export default function NewCardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [socials, setSocials] = useState<Socials>(EMPTY_SOCIALS);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  function handleNameChange(val: string) {
    setName(val);
    if (!usernameTouched) setUsername(slugify(val));
  }

  function setSocial(key: SocialKey, value: string) {
    setSocials((prev) => ({ ...prev, [key]: value }));
  }

  function normalizeOnBlur(key: SocialKey) {
    setSocials((prev) => ({ ...prev, [key]: normalizeSocial(prev[key], key) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !username.trim()) return;
    setStatus("loading");
    setError("");

    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        name: name.trim(),
        label: name.trim(),
        instagram: socials.instagram.trim(),
        linkedin: socials.linkedin.trim(),
        tiktok: socials.tiktok.trim(),
        twitter: socials.twitter.trim(),
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

        <h1 className="text-2xl font-bold text-white mb-2">New card</h1>
        <p className="text-gray-400 text-sm mb-8">Create a new card — perfect for different roles or businesses. You can add more details in the editor afterward.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Card name <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="e.g. My Business Card"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Card URL */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Card URL <span className="text-red-500">*</span></label>
            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus-within:border-blue-500 transition-colors">
              <span className="text-gray-600 shrink-0">/card/</span>
              <input
                type="text"
                placeholder="your-username"
                required
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUsernameTouched(true); }}
                className="flex-1 bg-transparent text-white placeholder-gray-600 focus:outline-none"
              />
            </div>
            <p className="text-gray-600 text-xs mt-1">Will be: /card/{username || "your-username"}</p>
          </div>

          {/* Company logo */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Company logo</label>
            <ImageUpload
              field="logo"
              currentUrl={logoUrl}
              label="Upload your company logo"
              shape="square"
              defer
              onUploaded={(url) => setLogoUrl(url)}
            />
          </div>

          {/* Social links — auto-connect on entry */}
          <div className="pt-1">
            <p className="text-xs font-medium text-gray-400 mb-1">Social links</p>
            <p className="text-gray-600 text-[11px] mb-3">Optional. Paste a profile URL or type an @handle — we link it automatically.</p>
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
                      className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {status === "error" && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={status === "loading" || !name.trim() || !username.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm mt-2"
          >
            {status === "loading" ? "Creating…" : "Create card →"}
          </button>
        </form>
      </div>
    </main>
  );
}
