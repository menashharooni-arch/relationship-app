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
const FONT_SCALE = 1.22; // gentle: bigger wording that still sits comfortably in each template

// Scale the wording up uniformly (so each template keeps its own hierarchy and looks
// organized) and release truncation so nothing gets cut off. The card grows in height
// to absorb the bigger text instead of clipping it.
function enlargeForSignature(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("*").forEach((node) => {
    const cs = getComputedStyle(node);
    const fs = parseFloat(cs.fontSize);
    if (fs) node.style.fontSize = `${(fs * FONT_SCALE).toFixed(2)}px`;
    if (cs.whiteSpace === "nowrap") {
      node.style.whiteSpace = "normal";
      node.style.maxWidth = "none";
      node.style.minWidth = "0";
      node.style.textOverflow = "clip";
      node.style.overflow = "visible";
    }
  });
  root.style.height = "auto";
  root.style.minHeight = "0";
  root.style.overflow = "visible";
}

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
<a href="${cardUrl}" target="_blank" style="text-decoration:none;"><img src="${imgUrl}" alt="${name} — business card" width="340" style="display:block;border:0;border-radius:12px;" /></a>
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
  // card's image. "v8" bump = auto-fit template layout change.
  const contentSig = "v8|" + hashStr(JSON.stringify(cardData) + "|" + template + "|" + cardUrl);
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
      // …and for its images (photo/logo) to load.
      const imgs = Array.from(el.querySelectorAll("img"));
      await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth > 0)
        ? Promise.resolve()
        : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); setTimeout(() => r(), 5000); })));

      // Hide the QR for the signature (done in the DOM, not via context, so the
      // templates stay server-renderable on the public card page).
      el.querySelectorAll<HTMLElement>("[data-qr]").forEach((q) => { q.style.display = "none"; });

      // Enlarge the wording once, in place. The hidden card is off-screen so this is
      // invisible; the flag stops repeat captures from compounding the scale. Skip the
      // user-designed "custom" template (absolute-positioned elements would overlap).
      if (template !== "custom" && !el.dataset.enlarged) {
        enlargeForSignature(el);
        el.dataset.enlarged = "1";
        await new Promise((r) => setTimeout(r, 200)); // let the reflow settle
      }

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
        cacheBust: true,
        backgroundColor: "#ffffff",
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
      {/* Hidden full-size render of the selected card. The QR is removed at capture time
          (DOM), then the wording is enlarged; html-to-image reads it via the browser engine. */}
      {mounted && (
        <div aria-hidden style={{ position: "absolute", left: -10000, top: 0, width: NATURAL, pointerEvents: "none", opacity: 0.01 }}>
          <div ref={cardRef} style={{ width: NATURAL }}>
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
                {status === "working" ? "Generating from your card…" : copied ? "Copied ✓ — paste it into your email signature" : "Copy signature"}
              </button>
              <p className="text-gray-600 text-[11px] mt-2 text-center">
                Paste into <strong className="text-gray-400">Gmail → Settings → Signature</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
