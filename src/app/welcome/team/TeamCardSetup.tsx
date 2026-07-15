"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import ImageUpload from "@/components/ImageUpload";
import ProfilePhotoSuggest from "@/components/ProfilePhotoSuggest";
import AddToWalletButton from "@/components/AddToWalletButton";

// One screen: name, photo, title, phone, email → live card. The company look
// (logo, colors, template, website, office contact) is applied by the server
// when the card is created, so nothing brand-related is asked for here.
//
// Deliberately contains NO pricing, plan choice, upsell, or link into the Office
// admin. Their employer already paid; this person's entire job is five fields.

type Company = {
  name: string | null;
  logoUrl: string | null;
  website: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  nickname: string | null;
};

type Props = {
  appUrl: string;
  prefill: { name: string; email: string; phone: string };
  company: Company;
  // Only true when the Apple Wallet signing certs are configured — otherwise the
  // button would hand them a download that fails.
  walletEnabled: boolean;
  // LinkedIn OAuth configured — enables "Suggest my profile picture".
  linkedinEnabled?: boolean;
};

export default function TeamCardSetup({ appUrl, prefill, company, walletEnabled, linkedinEnabled = false }: Props) {
  const [name, setName] = useState(prefill.name);
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState(prefill.phone);
  const [email, setEmail] = useState(prefill.email);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUsername, setLiveUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
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
      const username = json.card?.username ?? json.username ?? null;
      if (username) setLiveUsername(username);
      else window.location.href = "/dashboard"; // created, but no slug returned — dashboard shows it
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function downloadQr() {
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${name.trim().split(/\s+/)[0] || "my"}-card-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // ── Success: the card is live. Share it. ──────────────────────────────────
  if (liveUsername) {
    const cardUrl = `${appUrl}/card/${liveUsername}`;
    return (
      <div className="max-w-md mx-auto text-center">
        <p className="text-green-400 text-sm font-bold mb-2" role="status">Your card is live ✓</p>
        <h1 className="text-2xl font-bold text-white mb-2">
          Nice work{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}!
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          Share it however you like — every scan or tap shows your card instantly.
        </p>

        <div ref={qrWrapRef} className="bg-white rounded-2xl p-5 inline-block mb-5">
          <QRCodeCanvas value={cardUrl} size={168} />
        </div>

        <div className="space-y-2 max-w-xs mx-auto">
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 rounded-full transition-colors"
          >
            See my card →
          </a>
          <button
            onClick={() => {
              try { navigator.clipboard?.writeText(cardUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* older browsers */ }
            }}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-full transition-colors"
          >
            {copied ? "Link copied ✓" : "Copy my card link"}
          </button>
          <button
            onClick={downloadQr}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-full transition-colors"
          >
            Download my QR code
          </button>
          {walletEnabled && <AddToWalletButton username={liveUsername} />}
          <a href="/dashboard" className="block text-gray-500 hover:text-gray-300 text-xs py-2 transition-colors">
            Go to my dashboard
          </a>
        </div>
      </div>
    );
  }

  // ── The one-screen form ────────────────────────────────────────────────────
  const companyBits = [
    company.nickname && { k: "Card nickname", v: company.nickname },
    company.website && { k: "Website", v: company.website },
    company.phone && { k: "Office phone", v: company.phone },
    company.fax && { k: "Fax", v: company.fax },
    company.address && { k: "Address", v: company.address },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-7">
        {company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover bg-gray-900 mx-auto mb-4" />
        )}
        <h1 className="text-2xl font-bold text-white mb-1.5">
          {company.name ? `Your ${company.name} card` : "Your company card"}
        </h1>
        <p className="text-gray-400 text-sm">
          Your company details are already set up. Add yours and you&apos;re done.
        </p>
      </div>

      {/* What their employer already decided — read-only, so they can see the
          work is done rather than hunt for fields to fill. */}
      {(company.name || companyBits.length > 0) && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 mb-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
            Managed by your organization
          </p>
          <p className="text-gray-500 text-xs mb-2.5 -mt-1">
            Your company already prepared these details — they&apos;re on your card automatically.
          </p>
          <dl className="space-y-1.5">
            {company.name && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 text-xs">Company</dt>
                <dd className="text-gray-300 text-xs font-medium truncate">{company.name}</dd>
              </div>
            )}
            {companyBits.map((b) => (
              <div key={b.k} className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 text-xs">{b.k}</dt>
                <dd className="text-gray-300 text-xs font-medium truncate">{b.v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500 text-xs">Logo &amp; design</dt>
              <dd className="text-gray-300 text-xs font-medium">Set by your company</dd>
            </div>
          </dl>
        </div>
      )}

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
          <span className="block text-xs font-medium text-gray-400 mb-1">
            Your photo <span className="text-gray-600 font-normal">(optional, but cards with a face get saved more)</span>
          </span>
          <ImageUpload
            field="photo"
            currentUrl={photoUrl}
            label="Add a photo"
            shape="circle"
            defer
            onUploaded={(url) => setPhotoUrl(url || null)}
          />
          <ProfilePhotoSuggest
            enabled={linkedinEnabled}
            returnTo="/welcome/team"
            onConfirm={(url) => setPhotoUrl(url)}
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

        {error && <p className="text-red-400 text-xs" role="alert">{error}</p>}

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
