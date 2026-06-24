"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function NewCardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  function handleNameChange(val: string) {
    setName(val);
    if (!usernameTouched) {
      setUsername(slugify(val));
    }
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
        instagram: instagram.trim(),
        linkedin: linkedin.trim(),
        tiktok: tiktok.trim(),
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
        <p className="text-gray-400 text-sm mb-8">Create a new card — perfect for different roles or businesses. Add a logo and more details in the editor.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Social links */}
          <div className="pt-2">
            <p className="text-xs font-medium text-gray-400 mb-3">Social links</p>
            <div className="space-y-3">
              {[
                { label: "Instagram", value: instagram, setter: setInstagram, placeholder: "@username" },
                { label: "LinkedIn", value: linkedin, setter: setLinkedin, placeholder: "linkedin.com/in/you" },
                { label: "TikTok", value: tiktok, setter: setTiktok, placeholder: "@username" },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => alert("OAuth coming soon")}
                    className="mt-5 text-xs text-gray-600 hover:text-blue-400 border border-gray-700 hover:border-blue-600 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Connect
                  </button>
                </div>
              ))}
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
