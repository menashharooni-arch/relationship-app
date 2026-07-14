"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import ImageUpload from "@/components/ImageUpload";

// One screen: name, photo, title, phone, email → live card. The company look
// (logo, colors, template, website, office contact) is applied by the server
// when the card is created, so nothing brand-related is asked for here.

type Props = {
  appUrl: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  prefill: { name: string; email: string; phone: string };
};

export default function TeamCardSetup({ appUrl, companyName, companyLogoUrl, prefill }: Props) {
  const [name, setName] = useState(prefill.name);
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState(prefill.phone);
  const [email, setEmail] = useState(prefill.email);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUsername, setLiveUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          phone: phone.trim(),
          email: email.trim(),
          customization: { photoUrl: photoUrl ?? null },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? json.error ?? "Couldn't create your card — please try again.");
        return;
      }
      const username = json.username ?? json.card?.username ?? null;
      if (username) setLiveUsername(username);
      else window.location.href = "/dashboard"; // created, but no slug returned — dashboard shows it
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Success: the card is live. Share it. ──────────────────────────────────
  if (liveUsername) {
    const cardUrl = `${appUrl}/card/${liveUsername}`;
    return (
      <div className="max-w-md mx-auto text-center">
        <p className="text-green-400 text-sm font-bold mb-2">Your card is live ✓</p>
        <h1 className="text-2xl font-bold text-white mb-2">Nice work{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}!</h1>
        <p className="text-gray-400 text-sm mb-6">
          Share it however you like — every scan or tap shows your card instantly.
        </p>

        <div className="bg-white rounded-2xl p-5 inline-block mb-5">
          <QRCodeCanvas value={cardUrl} size={168} />
        </div>

        <div className="space-y-2 max-w-xs mx-auto">
          <button
            onClick={() => {
              try { navigator.clipboard?.writeText(cardUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* older browsers */ }
            }}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-full transition-colors"
          >
            {copied ? "Link copied ✓" : "Copy my card link"}
          </button>
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 rounded-full transition-colors"
          >
            See my card →
          </a>
          <a href="/dashboard" className="block text-gray-500 hover:text-gray-300 text-xs py-2 transition-colors">
            Go to my dashboard
          </a>
        </div>
      </div>
    );
  }

  // ── The one-screen form ────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-7">
        {companyLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={companyLogoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover bg-gray-900 mx-auto mb-4" />
        )}
        <h1 className="text-2xl font-bold text-white mb-1.5">
          {companyName ? `Your ${companyName} card` : "Your company card"}
        </h1>
        <p className="text-gray-400 text-sm">
          The company look is already applied. Add your details and you&apos;re done.
        </p>
      </div>

      <form onSubmit={save} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-gray-400">Your name</span>
          <input
            required autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Dana Lee"
            className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </label>

        <div>
          <span className="block text-xs font-medium text-gray-400 mb-1">Your photo <span className="text-gray-600 font-normal">(optional, but cards with a face get saved more)</span></span>
          <ImageUpload
            field="photo"
            currentUrl={photoUrl}
            label="Add a photo"
            shape="circle"
            defer
            onUploaded={(url) => setPhotoUrl(url || null)}
          />
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-400">Job title</span>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Sales Manager"
            className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Phone</span>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Email</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="dana@company.com"
              className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-full transition-colors"
        >
          {busy ? "Creating your card…" : "Create my card"}
        </button>
      </form>
    </div>
  );
}
