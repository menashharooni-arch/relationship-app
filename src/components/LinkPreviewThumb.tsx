"use client";

import { useEffect, useState } from "react";

// Small square link-preview thumbnail for the card editor's "Additional links"
// rows, so a link visibly HAS a preview the moment it's added — using the same
// /api/link-preview source (og:image, favicon fallback) the public Swift Links
// tiles use, so what you see here is what renders there. Always shows something:
// og:image → favicon → a link glyph, so a row never looks empty or broken.
type Preview = { image: string | null; favicon: string | null; title: string | null };

function fullHref(url: string) {
  const v = (url || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

export default function LinkPreviewThumb({ url }: { url: string }) {
  const [pv, setPv] = useState<Preview | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const href = fullHref(url);
    if (!href) return;
    let cancelled = false;
    setPv(null);
    setImgFailed(false);
    fetch(`/api/link-preview?url=${encodeURIComponent(href)}`)
      .then((r) => r.json())
      .then((d: Preview) => { if (!cancelled) setPv(d); })
      .catch(() => { if (!cancelled) setPv({ image: null, favicon: null, title: null }); });
    return () => { cancelled = true; };
  }, [url]);

  const img = (!imgFailed && pv?.image) || null;
  const favicon = (!imgFailed && pv?.favicon) || (imgFailed ? pv?.favicon : null) || pv?.favicon || null;

  return (
    <span className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
      ) : favicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={favicon} alt="" className="w-5 h-5 object-contain" loading="lazy" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={2} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      )}
    </span>
  );
}
