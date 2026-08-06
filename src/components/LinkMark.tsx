"use client";

import { useState } from "react";
import { faviconFor, monogramFor, monogramTint } from "@/lib/link-brand";

// A link's little brand mark: its favicon, over a coloured monogram.
//
// The monogram is painted FIRST and always — the favicon is a lazy third-party
// image that cross-fades on top of it. That ordering is the whole point: a
// favicon-only mark is an empty box for as long as a DNS + TLS handshake to
// google.com takes, on a page opened over mobile data right after a QR scan. If
// the request is slow, blocked, region-restricted or the domain simply has no
// icon, the monogram stays and the row still looks designed.
export default function LinkMark({ url, size = 16 }: { url: string; size?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = faviconFor(url);
  const showFavicon = loaded && !failed;

  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center font-bold text-white transition-opacity duration-200"
        style={{
          background: monogramTint(url),
          borderRadius: Math.max(3, Math.round(size * 0.28)),
          fontSize: Math.max(8, Math.round(size * 0.56)),
          lineHeight: 1,
          opacity: showFavicon ? 0 : 1,
        }}
      >
        {monogramFor(url)}
      </span>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="relative object-contain transition-opacity duration-200"
          style={{ width: size, height: size, opacity: loaded ? 1 : 0 }}
        />
      )}
    </span>
  );
}
