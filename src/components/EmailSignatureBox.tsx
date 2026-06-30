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
};

function buildSignatureHtml(name: string, company: string, cardUrl: string, imgUrl: string): string {
  const header = `<div style="font-size:14px;color:#111827;margin-bottom:6px;"><strong>${name}</strong>${company ? ` | ${company}` : ""}</div>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:0;">
${header}
<a href="${cardUrl}" target="_blank" style="text-decoration:none;"><img src="${imgUrl}" alt="${name} — business card" width="220" style="display:block;border:0;border-radius:12px;" /></a>
<div style="margin-top:8px;font-size:14px;"><a href="${cardUrl}" target="_blank" style="color:#2563eb;text-decoration:none;font-weight:bold;">Contact me →</a></div>
</td></tr></table>`;
}

export default function EmailSignatureBox({ cardData, template, name, company, cardUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [regen, setRegen] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const Template = TEMPLATE_MAP[template] ?? ClassicPro;
  const cacheKey = `sc_sig_${cardUrl}`;

  // On load: show a cached image instantly, and (re)generate it automatically if
  // it's missing or stale — no click needed.
  useEffect(() => {
    let fresh = false;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const c = JSON.parse(raw);
        if (c.url) setImgUrl(c.url);
        fresh = Date.now() - (c.at || 0) < 6 * 3600 * 1000;
      }
    } catch { /* ignore */ }
    setMounted(true);
    if (!fresh) setRegen((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardUrl]);

  // Capture the hidden card pixel-perfect and host it whenever a regen is requested.
  useEffect(() => {
    if (!mounted || regen === 0) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const el = cardRef.current;
        if (!el) return;
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: null, logging: false });
        const dataUrl = canvas.toDataURL("image/png");
        const res = await fetch("/api/card-signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        const d = await res.json().catch(() => ({}));
        if (!cancelled && d.url) {
          setImgUrl(d.url);
          try { localStorage.setItem(cacheKey, JSON.stringify({ url: d.url, at: Date.now() })); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }, 800); // let the card's photo + QR finish rendering
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, regen]);

  function openBox() { setOpen(true); }

  async function copy() {
    if (!imgUrl) return;
    const html = buildSignatureHtml(name, company, cardUrl, imgUrl);
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <>
      {/* Hidden full-size card render used only for the capture */}
      {mounted && (
        <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, width: NATURAL, pointerEvents: "none" }}>
          <div ref={cardRef}>
            <Template data={template === "custom" ? cardData : withoutSocials(cardData)} />
          </div>
        </div>
      )}

      {/* Dashboard card */}
      <button
        type="button"
        onClick={openBox}
        className="w-full text-left bg-gray-900 border border-gray-800/80 rounded-2xl p-5 hover:border-gray-700 transition-colors group"
      >
        <p className="text-white font-semibold text-sm flex items-center gap-1.5"><span>✉️</span> Email signature</p>
        <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">
          Copy this and use it as your email signature — your real card in every email you send.
        </p>
        <div className="mt-3 rounded-xl border border-gray-700/60 bg-gray-800/40 h-28 flex items-center justify-center text-gray-500 text-xs">
          {imgUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={imgUrl} alt="Your card" className="h-full w-auto object-contain py-2" />
            : "Generating from your card…"}
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300">Preview &amp; copy →</span>
      </button>

      {/* Modal */}
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
                    {imgUrl ? (
                      <a href={cardUrl} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgUrl} alt="card" width={200} className="block rounded-[12px]" />
                      </a>
                    ) : (
                      <div className="h-40 w-[200px] rounded-[12px] bg-gray-100 flex items-center justify-center text-gray-400 text-xs">Generating your card…</div>
                    )}
                    <a href={cardUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[14px] font-bold text-blue-600 no-underline">Contact me →</a>
                  </div>
                </div>
              </div>

              <button onClick={copy} disabled={!imgUrl}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-full transition-colors">
                {!imgUrl ? "Generating your card…" : copied ? "Copied ✓ — now paste it into your email signature" : "Copy signature"}
              </button>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <p className="text-gray-600 text-[11px] text-center">
                  Paste into <strong className="text-gray-400">Gmail → Settings → Signature</strong>. Links straight to your SwiftCard.
                </p>
              </div>
              <button onClick={() => setRegen((n) => n + 1)} className="w-full mt-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                Edited your card? Update the image ↻
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
