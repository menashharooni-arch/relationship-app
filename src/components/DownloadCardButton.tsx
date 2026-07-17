"use client";

import { useState } from "react";
import { detectNativeApp } from "@/lib/platform";

interface Props {
  cardRef: React.RefObject<HTMLDivElement | null>;
  filename?: string;
  compact?: boolean;
  /** Public card URL — on native, sharing this replaces the PNG download that
      WKWebView can't save. */
  shareUrl?: string;
}

// Inline every <img> src as a data URL before capturing — html-to-image
// re-fetches images while rasterizing and can drop them otherwise. Falls back
// to the same-origin image proxy when a remote host blocks the direct fetch.
async function inlineImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(imgs.map(async (img) => {
    const src = img.currentSrc || img.getAttribute("src") || "";
    if (!src || src.startsWith("data:")) return;
    const candidates = [src];
    if (/^https?:\/\//.test(src)) candidates.push(`/api/img-proxy?url=${encodeURIComponent(src)}`);
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) continue;
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
        return;
      } catch { /* try next candidate */ }
    }
  }));
}

export default function DownloadCardButton({ cardRef, filename = "swiftcard.png", compact = false, shareUrl }: Props) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const loading = status === "working";

  async function handleDownload() {
    const el = cardRef.current;
    if (!el || loading) return;
    // Native shell: WKWebView can't save the generated PNG data URL. Share the
    // public card link via the native share sheet instead — a working action,
    // not a dead tap. Web keeps the PNG capture below.
    if (shareUrl && detectNativeApp()) {
      try {
        const { Share } = await import("@capacitor/share");
        await Share.share({ url: shareUrl });
        return;
      } catch { /* fall through to the capture path */ }
    }
    setStatus("working");
    // Neutralize any display scaling so the capture is full resolution.
    const prevTransform = el.style.transform;
    try {
      el.style.transform = "none";
      await inlineImages(el);
      await new Promise((r) => setTimeout(r, 120)); // let reflow settle

      // Same proven recipe as the share/signature captures: html-to-image
      // (handles Tailwind 4's oklch colors, which html2canvas chokes on) with
      // the node rendered natively larger — pixelRatio-only upscaling is blurry.
      const { toPng } = await import("html-to-image");
      const w = el.offsetWidth || 460;
      const h = el.offsetHeight || 263;
      const SCALE = 3;
      const dataUrl = await Promise.race([
        toPng(el, {
          width: w * SCALE,
          height: h * SCALE,
          pixelRatio: 1,
          cacheBust: false,
          style: { transform: `scale(${SCALE})`, transformOrigin: "top left" },
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
      ]);
      if (!dataUrl || dataUrl.length < 5000) throw new Error("blank capture");

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
      setStatus("idle");
    } catch {
      // Show it failed instead of silently doing nothing.
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    } finally {
      el.style.transform = prevTransform;
    }
  }

  const spinner = (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
  const icon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
  const label = loading ? "Saving…" : status === "error" ? "Couldn't save — retry" : compact ? "Download" : "Download card as image";

  if (compact) {
    return (
      <button
        onClick={handleDownload}
        disabled={loading}
        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border rounded-full py-2 transition-colors disabled:opacity-50 ${
          status === "error"
            ? "text-amber-300 bg-amber-950/40 border-amber-800/50"
            : "text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border-gray-700"
        }`}
      >
        {loading ? spinner : icon}
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={`flex items-center gap-2 w-full justify-center border font-semibold py-2.5 rounded-full transition-colors text-sm disabled:opacity-50 ${
        status === "error"
          ? "text-amber-300 border-amber-800/60"
          : "border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white"
      }`}
    >
      {loading ? spinner : icon}
      {label}
    </button>
  );
}
