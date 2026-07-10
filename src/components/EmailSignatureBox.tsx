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
const NATURAL = 460;       // same natural card width the public page renders at
const CARD_BG = "#FAF7F2"; // the public card page background (shows at the card's rounded corners)

type Props = {
  cardData: CardData;
  template: string;
  name: string;
  company: string;
  cardUrl: string;
  username: string;
  storageUrl: string;
  ogUrl: string;
};

// Short stable hash of a string (djb2). Used to detect when the SELECTED card's
// content changes so the signature re-captures — and only ever for that card.
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Replace every <img> src with an inlined data URL BEFORE capturing. html-to-image
// otherwise re-fetches each image while rasterizing, which (with cache-busting or
// a slow proxy MISS) was dropping the photo/logo and leaving a blank panel. Once
// the src is a data URL there's nothing to fetch — the image always embeds.
async function inlineImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(imgs.map(async (img) => {
    const src = img.currentSrc || img.getAttribute("src") || "";
    if (!src || src.startsWith("data:")) return;
    try {
      const res = await fetch(src, { cache: "force-cache" });
      if (!res.ok) return;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = dataUrl;
        setTimeout(resolve, 3000);
      });
    } catch { /* keep the original src — better a proxied fetch than nothing */ }
  }));
}

function CardPreview({ src, ready, status, onLoad, onError }: {
  src: string; ready: boolean; status: "idle" | "working" | "error"; onLoad: () => void; onError: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-700/60 bg-white overflow-hidden relative min-h-[120px] flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} onLoad={onLoad} onError={onError} alt="Your card" className={`w-full block ${ready ? "" : "hidden"}`} />
      {!ready && (
        <span className="text-gray-400 text-xs py-10">
          {status === "error" ? "Couldn't generate — reopen to retry" : "Generating your card…"}
        </span>
      )}
    </div>
  );
}

function buildSignatureHtml(name: string, company: string, cardUrl: string, imgUrl: string): string {
  const header = `<div style="font-size:14px;color:#111827;margin-bottom:6px;"><strong>${name}</strong>${company ? ` | ${company}` : ""}</div>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:0;">
${header}
<a href="${cardUrl}" target="_blank" style="text-decoration:none;"><img src="${imgUrl}" alt="${name} — business card" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;border-radius:12px;" /></a>
<div style="margin-top:8px;font-size:14px;"><a href="${cardUrl}" target="_blank" style="color:#2563eb;text-decoration:none;font-weight:bold;">Contact me</a></div>
</td></tr></table>`;
}

export default function EmailSignatureBox({ cardData, template, name, company, cardUrl, username, storageUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [displaySrc, setDisplaySrc] = useState(storageUrl);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const capturingRef = useRef(false);
  const lastUrlRef = useRef<string | null>(null);
  const lastSigRef = useRef<string | null>(null); // content hash of the last successful capture
  const Template = TEMPLATE_MAP[template] ?? ClassicPro;
  // Freshness is keyed to THIS card's username + a hash of its own content (+ a code
  // version). Re-captures exactly when the selected card changes; never reuses another
  // card's image. "v10" bump = signature is now a pixel-exact copy of the card (no
  // font enlarging, QR kept, card-page background) — forces everyone to re-capture.
  const contentSig = "v10|" + hashStr(JSON.stringify(cardData) + "|" + template + "|" + cardUrl);
  const hashKey = `sc_sighash_${username}`;

  // Photo/logo through a same-origin proxy so html2canvas can read them.
  const proxy = (u?: string | null) => (u && /^https?:\/\//.test(u) ? `/api/img-proxy?url=${encodeURIComponent(u)}` : u ?? null);
  const captureData = {
    ...cardData,
    photoUrl: proxy(cardData.photoUrl),
    logoUrl: proxy((cardData as { logoUrl?: string | null }).logoUrl),
  } as CardData;

  async function captureAndUpload(): Promise<string | null> {
    // Never capture/upload without a real card identity (defensive: the dashboard
    // only renders this with a selected card, but guard against any path collision).
    if (!username || !/^[a-z0-9-]{1,40}$/i.test(username)) return null;
    if (capturingRef.current) return null;
    capturingRef.current = true;
    setStatus("working");
    try {
      const el = cardRef.current;
      if (!el) return null;
      // Wait for the lazy-loaded template to actually render…
      for (let i = 0; i < 80 && el.offsetHeight < 150; i++) await new Promise((r) => setTimeout(r, 100));
      // …then inline the photo/logo as data URLs so they always embed (this is
      // what makes the signature a faithful copy of the real card).
      await inlineImages(el);

      // NO modifications to the card here — the signature is a PIXEL-EXACT copy of
      // the real SwiftCard: same fonts, sizes, placement, photo, logo, and the QR
      // (all rendered by the identical template at the identical NATURAL width the
      // public card page uses). The wording is deliberately NOT enlarged and the QR
      // is deliberately NOT hidden, so it matches the card the visitor sees 1:1.

      // Let fonts + reflow settle so text metrics are identical on every capture
      // (deterministic output — the signature looks the same every time).
      await new Promise((r) => setTimeout(r, 200));

      // html-to-image renders via the browser engine (SVG foreignObject), so it
      // supports Tailwind v4's oklch() colors — html2canvas does not and was throwing.
      // Render the card NATIVELY larger (transform scale) rather than bumping pixelRatio:
      // foreignObject HTML rasterizes at 1x and pixelRatio only upscales it (blurry), so
      // scaling the node up makes the text crisp at full resolution.
      const { toPng } = await import("html-to-image");
      const w = el.offsetWidth || NATURAL;
      const h = el.offsetHeight || NATURAL;
      const SCALE = 4;
      const dataUrl = await toPng(el, {
        width: w * SCALE,
        height: h * SCALE,
        pixelRatio: 1,
        cacheBust: false, // images are already inlined; cache-busting was dropping the photo
        backgroundColor: CARD_BG, // the card page's background, so corners match exactly
        style: { transform: `scale(${SCALE})`, transformOrigin: "top left" },
      });
      if (!dataUrl || dataUrl.length < 5000) { setStatus("error"); return null; } // blank guard
      const res = await fetch("/api/card-signature", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl, username }),
      });
      if (!res.ok) { setStatus("error"); return null; }

      const url = `${storageUrl}?t=${Date.now()}`;
      lastUrlRef.current = url;
      lastSigRef.current = contentSig;
      setDisplaySrc(url);
      setStatus("idle");
      try { localStorage.setItem(hashKey, contentSig); } catch { /* ignore */ }
      return url;
    } catch {
      setStatus("error");
      return null;
    } finally {
      capturingRef.current = false;
    }
  }

  // On load / whenever THIS card's content changes: regenerate from the real card so the
  // image always matches the currently-selected card. Keyed to username+content hash, so
  // it never reuses or is triggered by a different card.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- image capture only runs client-side
    setMounted(true);
    let prev = "";
    try { prev = localStorage.getItem(hashKey) || ""; } catch { /* ignore */ }
    if (prev !== contentSig) {
      const t = setTimeout(() => { captureAndUpload(); }, 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, contentSig]);

  // Hosted image 404s (never captured) → generate from the real card. No wrong fallback image.
  function onImgError() {
    setReady(false);
    if (!capturingRef.current) captureAndUpload();
  }

  async function copy() {
    setStatus("working");
    // Wait out any in-flight capture, then ensure the image we copy was captured from
    // THIS card's current content (re-capture if the card changed since last capture).
    for (let i = 0; i < 80 && capturingRef.current; i++) await new Promise((r) => setTimeout(r, 100));
    if (lastSigRef.current !== contentSig || !lastUrlRef.current) await captureAndUpload();
    const img = lastUrlRef.current;
    if (!img) { setStatus("error"); return; }
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
    setStatus("idle");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const onLoad = () => { setReady(true); setStatus("idle"); };

  return (
    <>
      {/* Hidden full-size render of the selected card — captured AS-IS (no font
          scaling, QR kept) so the signature image is a pixel-exact copy of the card.
          html-to-image reads it via the browser engine. */}
      {mounted && (
        <div aria-hidden style={{ position: "absolute", left: -10000, top: 0, width: NATURAL, pointerEvents: "none", opacity: 0.01 }}>
          <div ref={cardRef} style={{ width: NATURAL, background: CARD_BG }}>
            <Template data={template === "custom" ? captureData : withoutSocials(captureData)} />
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-4">
        <p className="text-white font-semibold text-sm">Email signature</p>
        <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">
          Copy and use this as your email signature — a clickable link to your card, right in your signature. A new way to do things.
        </p>
        <button
          type="button"
          onClick={() => { if (status === "error" && !ready) captureAndUpload(); setOpen(true); }}
          className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 rounded-full transition-colors"
        >
          Preview &amp; copy
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          {/* max-h + flex-col so the body scrolls on small phones instead of
              overflowing off-screen; header (with the X) stays pinned. */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
              <p className="text-white font-semibold text-sm">Your email signature</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close and return to dashboard"
                className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-gray-500 text-xs mb-3">Here&apos;s how it looks at the bottom of an email you send:</p>
              <div className="rounded-xl border border-gray-700/60 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-200 text-[12px] text-gray-500 space-y-0.5">
                  <p><span className="text-gray-400">To:</span> sarah@acme.com</p>
                  <p><span className="text-gray-400">Subject:</span> Great connecting today</p>
                </div>
                <div className="px-4 py-3 text-[13px] text-gray-800 leading-relaxed">
                  <p>Hi Sarah,</p>
                  <p className="mt-2">Really enjoyed chatting earlier. My contact info is below in my signature. Let&apos;s keep in touch!</p>
                  <p className="mt-2">Best,</p>
                  <div className="mt-3">
                    <p className="text-[14px] text-gray-900 mb-1.5"><strong>{name}</strong>{company ? ` | ${company}` : ""}</p>
                    <a href={cardUrl} target="_blank" rel="noopener noreferrer" className="block w-[300px] max-w-full"><CardPreview src={displaySrc} ready={ready} status={status} onLoad={onLoad} onError={onImgError} /></a>
                    <a href={cardUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[14px] font-bold text-blue-600 no-underline">Contact me</a>
                  </div>
                </div>
              </div>
              <button onClick={copy} disabled={!ready || status === "working"}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-full transition-colors">
                {status === "working" ? "Generating from your card…" : copied ? "Copied ✓" : "Copy signature"}
              </button>

              {/* Concise 3-step directions */}
              <ol className="mt-4 space-y-2.5">
                <li className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-300 text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-gray-300 text-[12px] leading-relaxed">Tap <strong className="text-white">Copy signature</strong> above.</p>
                </li>
                <li className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-300 text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-gray-300 text-[12px] leading-relaxed">Open your email below and <strong className="text-white">paste</strong> it into your signature settings.</p>
                </li>
                <li className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-300 text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-gray-300 text-[12px] leading-relaxed">Using a different email? Paste it into that app&apos;s signature settings.</p>
                </li>
              </ol>

              {/* Open the user's email signature settings directly */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { label: "Gmail", url: "https://mail.google.com/mail/u/0/#settings/general" },
                  { label: "Outlook", url: "https://outlook.live.com/mail/0/options/mail/messageContent" },
                  { label: "Yahoo", url: "https://mail.yahoo.com/d/settings/1" },
                ].map((p) => (
                  <a
                    key={p.label}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-[11px] font-semibold py-2 rounded-xl transition-colors"
                  >
                    {p.label}
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 opacity-60"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
