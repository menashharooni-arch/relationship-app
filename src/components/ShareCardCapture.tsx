"use client";

// Renders the user's card EXACTLY as it appears on the public card page, then
// rasterizes it pixel-perfect (html-to-image, browser engine) and uploads it so
// the card's share-link preview (Open Graph image) is a real picture of the
// card — identical to the card it links to. Runs invisibly on the dashboard for
// the active card; re-captures only when THAT card's content changes.

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

const NATURAL = 460;   // same natural card width the public page renders at
const CARD_BG = "#FAF7F2"; // the public card page background (shows at the card's rounded corners)

// Short stable hash (djb2) so we only re-capture when this card's content changes.
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export default function ShareCardCapture({
  cardData,
  template,
  username,
}: {
  cardData: CardData;
  template: string;
  username: string;
}) {
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const capturingRef = useRef(false);
  const Template = TEMPLATE_MAP[template] ?? ClassicPro;

  // Capture-logic version. Bump to force a global re-capture ("v2" = auto-fit templates).
  const contentSig = "share-v2|" + hashStr(JSON.stringify(cardData) + "|" + template);
  const hashKey = `sc_sharehash_${username}`;

  // Photo/logo through a same-origin proxy so the browser can read them into the canvas.
  const proxy = (u?: string | null) => (u && /^https?:\/\//.test(u) ? `/api/img-proxy?url=${encodeURIComponent(u)}` : u ?? null);
  const captureData = {
    ...cardData,
    photoUrl: proxy(cardData.photoUrl),
    logoUrl: proxy((cardData as { logoUrl?: string | null }).logoUrl),
  } as CardData;

  // Rasterize the card once. Every image (photo/logo) must be loaded first so
  // the capture shows the whole card. A timeout stops a rare html-to-image hang
  // (font/resource embedding) from wedging the capture forever.
  async function renderOnce(): Promise<string | null> {
    const el = cardRef.current;
    if (!el) return null;
    // Wait for the lazy template to render…
    for (let i = 0; i < 80 && el.offsetHeight < 120; i++) await new Promise((r) => setTimeout(r, 100));
    // …and for its images (photo/logo) to load so they're in the capture.
    const imgs = Array.from(el.querySelectorAll("img"));
    await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth > 0)
      ? Promise.resolve()
      : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); setTimeout(() => r(), 6000); })));
    await new Promise((r) => setTimeout(r, 200)); // let fonts/reflow settle

    // Render the node NATIVELY larger (transform scale) rather than bumping
    // pixelRatio: foreignObject rasterizes at 1x and pixelRatio only upscales
    // (blurry), so scaling the node up keeps text crisp at full resolution.
    // No cacheBust: the node was just freshly rendered (nothing stale to bust),
    // and appending cache-bust queries to every resource is a common hang cause.
    const { toPng } = await import("html-to-image");
    const w = el.offsetWidth || NATURAL;
    const h = el.offsetHeight || NATURAL;
    const SCALE = 4;
    const png = toPng(el, {
      width: w * SCALE,
      height: h * SCALE,
      pixelRatio: 1,
      cacheBust: false,
      backgroundColor: CARD_BG,
      style: { transform: `scale(${SCALE})`, transformOrigin: "top left" },
    });
    const dataUrl = await Promise.race([
      png,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
    ]);
    return dataUrl && dataUrl.length >= 5000 ? dataUrl : null; // null = blank/timed-out
  }

  async function captureAndUpload() {
    if (!username || !/^[a-z0-9-]{1,40}$/i.test(username)) return;
    if (capturingRef.current) return;
    capturingRef.current = true;
    try {
      // Retry a couple of times — a first attempt can time out while fonts/images
      // warm up; a retry then succeeds. The OG route serves a rendered fallback
      // until a real capture lands, so previews never break in the meantime.
      let dataUrl: string | null = null;
      for (let attempt = 0; attempt < 3 && !dataUrl; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
        dataUrl = await renderOnce().catch(() => null);
      }
      if (!dataUrl) return;
      const res = await fetch("/api/card-share-image", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl, username }),
      });
      if (res.ok) {
        try { localStorage.setItem(hashKey, contentSig); } catch { /* ignore */ }
      }
    } catch {
      /* best-effort — the OG route falls back to a rendered approximation */
    } finally {
      capturingRef.current = false;
    }
  }

  // On load / whenever this card's content changes, regenerate so the share
  // preview always matches the current card.
  useEffect(() => {
    setMounted(true);
    let prev = "";
    try { prev = localStorage.getItem(hashKey) || ""; } catch { /* ignore */ }
    if (prev !== contentSig) {
      const t = setTimeout(() => { captureAndUpload(); }, 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, contentSig]);

  if (!mounted) return null;

  // Hidden, off-screen render of the card EXACTLY as the public page shows it
  // (withoutSocials for standard templates; QR kept; natural sizing).
  return (
    <div aria-hidden style={{ position: "absolute", left: -10000, top: 0, width: NATURAL, pointerEvents: "none", opacity: 0.01 }}>
      <div ref={cardRef} style={{ width: NATURAL, background: CARD_BG }}>
        <Template data={template === "custom" ? captureData : withoutSocials(captureData)} />
      </div>
    </div>
  );
}
