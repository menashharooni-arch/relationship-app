"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CardData } from "@/components/card-templates/types";
import { withoutSocials } from "@/components/card-templates/types";

const ClassicPro    = dynamic(() => import("@/components/card-templates/ClassicPro"),    { ssr: false });
const ModernBold    = dynamic(() => import("@/components/card-templates/ModernBold"),    { ssr: false });
const PhotoFirst    = dynamic(() => import("@/components/card-templates/PhotoFirst"),    { ssr: false });
const LocalBusiness = dynamic(() => import("@/components/card-templates/LocalBusiness"), { ssr: false });
const LuxuryMinimal = dynamic(() => import("@/components/card-templates/LuxuryMinimal"), { ssr: false });
const CustomCard    = dynamic(() => import("@/components/card-templates/CustomCard"),    { ssr: false });

const TEMPLATE_MAP: Record<string, React.ComponentType<{ data: CardData }>> = {
  "classic-pro": ClassicPro, "modern-bold": ModernBold, "photo-first": PhotoFirst,
  "local-business": LocalBusiness, "luxury-minimal": LuxuryMinimal, "custom": CustomCard,
};
const NATURAL = 460;

type Props = {
  cardData: CardData;
  template: string;
  name: string;
  company: string;
  cardUrl: string;
  username: string;
  storageUrl: string; // stable hosted URL of the captured card (per username)
  ogUrl: string;      // instant server-rendered fallback while the capture uploads
};

function buildSignatureHtml(name: string, company: string, cardUrl: string, imgUrl: string): string {
  const header = `<div style="font-size:14px;color:#111827;margin-bottom:6px;"><strong>${name}</strong>${company ? ` | ${company}` : ""}</div>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:0;">
${header}
<a href="${cardUrl}" target="_blank" style="text-decoration:none;"><img src="${imgUrl}" alt="${name} — business card" width="340" style="display:block;border:0;border-radius:12px;" /></a>
<div style="margin-top:8px;font-size:14px;"><a href="${cardUrl}" target="_blank" style="color:#2563eb;text-decoration:none;font-weight:bold;">Contact me →</a></div>
</td></tr></table>`;
}

export default function EmailSignatureBox({ cardData, template, name, company, cardUrl, username, storageUrl, ogUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [displaySrc, setDisplaySrc] = useState(storageUrl);
  const [hasCaptured, setHasCaptured] = useState(true);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const capturingRef = useRef(false);
  const lastUrlRef = useRef<string | null>(null);
  const Template = TEMPLATE_MAP[template] ?? ClassicPro;
  const atKey = `sc_sigat_${username}`;

  const proxy = (u?: string | null) => (u && /^https?:\/\//.test(u) ? `/api/img-proxy?url=${encodeURIComponent(u)}` : u ?? null);
  const captureData = {
    ...cardData,
    photoUrl: proxy(cardData.photoUrl),
    logoUrl: proxy((cardData as { logoUrl?: string | null }).logoUrl),
  } as CardData;

  async function captureAndUpload(): Promise<string | null> {
    if (capturingRef.current) return null;
    const el = cardRef.current;
    if (!el) return null;
    capturingRef.current = true;
    try {
      const imgs = Array.from(el.querySelectorAll("img"));
      await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth > 0)
        ? Promise.resolve()
        : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); setTimeout(() => r(), 4000); })));
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: null, logging: false });
      const dataUrl = canvas.toDataURL("image/png");
      const res = await fetch("/api/card-signature", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl, username }),
      });
      if (!res.ok) return null;
      const url = `${storageUrl}?t=${Date.now()}`;
      lastUrlRef.current = url;
      setHasCaptured(true);
      setDisplaySrc(url);
      try { localStorage.setItem(atKey, String(Date.now())); } catch { /* ignore */ }
      return url;
    } catch {
      return null;
    } finally {
      capturingRef.current = false;
    }
  }

  useEffect(() => {
    setMounted(true);
    let stale = true;
    try { stale = Date.now() - Number(localStorage.getItem(atKey) || 0) > 6 * 3600 * 1000; } catch { /* ignore */ }
    if (stale) {
      const t = setTimeout(() => { captureAndUpload(); }, 900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  function onImgError() {
    if (displaySrc.startsWith(ogUrl)) return;
    setHasCaptured(false);
    setDisplaySrc(ogUrl);
    setTimeout(() => { captureAndUpload(); }, 900);
  }

  async function copy() {
    setCopying(true);
    const fresh = await captureAndUpload();
    const img = fresh ?? lastUrlRef.current ?? (hasCaptured ? storageUrl : ogUrl);
    const html = buildSignatureHtml(name, company, cardUrl, img);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([`${name}\n${cardUrl}`], { type: "text/plain" }),
        }),
      ]);
    } catch {
      try { await navigator.clipboard.writeText(html); } catch { /* ignore */ }
    }
    setCopying(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <>
      {/* Hidden full-size render of the EXACT selected card — a carbon copy, QR and all */}
      {mounted && (
        <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, width: NATURAL, pointerEvents: "none" }}>
          <div ref={cardRef}>
            <Template data={template === "custom" ? captureData : withoutSocials(captureData)} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left bg-gray-900 border border-gray-800/80 rounded-2xl p-5 hover:border-gray-700 transition-colors group"
      >
        <p className="text-white font-semibold text-sm flex items-center gap-1.5"><span>✉️</span> Email signature</p>
        <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">
          Copy this and use it as your email signature — your real card in every email you send.
        </p>
        <div className="mt-3 rounded-xl border border-gray-700/60 bg-white flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displaySrc} onError={onImgError} alt="Your card" className="w-full block" />
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300">Preview &amp; copy →</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <p className="text-white font-semibold text-sm">Your email signature</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>

            <div className="p-5">
              <p className="text-gray-500 text-xs mb-3">Here&apos;s how it looks at the bottom of an email you send:</p>

              <div className="rounded-xl border border-gray-700/60 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-200 text-[12px] text-gray-500 space-y-0.5">
                  <p><span className="text-gray-400">To:</span> sarah@acme.com</p>
                  <p><span className="text-gray-400">Subject:</span> Great connecting today</p>
                </div>
                <div className="px-4 py-3 text-[13px] text-gray-800 leading-relaxed">
                  <p>Hi Sarah,</p>
                  <p className="mt-2">Really enjoyed chatting earlier — here&apos;s my card so you have everything in one place.</p>
                  <p className="mt-2">Talk soon,</p>
                  <div className="mt-3">
                    <p className="text-[14px] text-gray-900 mb-1.5"><strong>{name}</strong>{company ? ` | ${company}` : ""}</p>
                    <a href={cardUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={displaySrc} onError={onImgError} alt="card" className="block rounded-[12px] w-[300px] max-w-full" />
                    </a>
                    <a href={cardUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[14px] font-bold text-blue-600 no-underline">Contact me →</a>
                  </div>
                </div>
              </div>

              <button onClick={copy} disabled={copying}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-full transition-colors">
                {copying ? "Updating from your card…" : copied ? "Copied ✓ — paste it into your email signature" : "Copy signature"}
              </button>
              <p className="text-gray-600 text-[11px] mt-2 text-center">
                Paste into <strong className="text-gray-400">Gmail → Settings → Signature</strong>. The image + link always point to your current card.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
