"use client";

// Featured links, replicating link.me's "album" grid exactly:
// - Two tiles per row (calc(50% - 6px)); with an odd count the FIRST tile goes
//   full-width with a taller image and bigger title.
// - Every tile is an image card: video thumbnail or og:image, with a dark
//   bottom gradient, a centered 2-line title, and a small favicon circle
//   top-left. Links with no preview image get a branded gradient tile so they
//   still look designed.
// - A glossy "shine" sweeps across tiles (link.me's featured-link animation).
// - YouTube/Vimeo links play INLINE: tapping the play button swaps the tile to
//   an autoplaying embed (expanding it to full width) instead of leaving.

import { useEffect, useState } from "react";
import { videoThumbnail, videoEmbed } from "@/lib/video";
import { triggerSignupNudge } from "@/lib/nudge";

type Link = { emoji: string; label: string; url: string };
type Preview = { image: string | null; favicon: string | null; title: string | null };

// Fallback gradients for links with no preview image — picked by index so
// neighboring tiles differ.
const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #4338ca 0%, #7c3aed 55%, #db2777 100%)",
  "linear-gradient(135deg, #0e7490 0%, #2563eb 60%, #4f46e5 100%)",
  "linear-gradient(135deg, #b45309 0%, #dc2626 60%, #be185d 100%)",
  "linear-gradient(135deg, #065f46 0%, #0d9488 60%, #0284c7 100%)",
];

function fullHref(url: string) {
  const v = (url || "").trim();
  if (!v) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

export default function SwiftLinkButtons({ links }: { links: Link[] }) {
  // Fetched preview (og:image + favicon fallback) for non-video links, by index.
  const [previews, setPreviews] = useState<Record<number, Preview>>({});
  // Index of the tile currently playing an inline video, if any.
  const [playing, setPlaying] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    links.forEach((link, i) => {
      if (videoThumbnail(link.url)) return; // video handled instantly below
      fetch(`/api/link-preview?url=${encodeURIComponent(fullHref(link.url))}`)
        .then((r) => r.json())
        .then((d: Preview) => { if (!cancelled) setPreviews((p) => ({ ...p, [i]: d })); })
        .catch(() => { if (!cancelled) setPreviews((p) => ({ ...p, [i]: { image: null, favicon: null, title: null } })); });
    });
    return () => { cancelled = true; };
  }, [links]);

  if (!links.length) return null;

  const odd = links.length % 2 === 1;

  return (
    <div className="w-full mt-6 flex flex-wrap justify-between">
      {/* link.me's featured-link shine sweep */}
      <style>{`
        @keyframes sc-shine { 0% { transform: translateX(-160%) skewX(-18deg); } 55%, 100% { transform: translateX(320%) skewX(-18deg); } }
        .sc-shine { position: absolute; top: -10%; bottom: -10%; left: 0; width: 45%; pointer-events: none; z-index: 5;
          background: linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 100%);
          animation: sc-shine 3.8s ease-in-out infinite; }
      `}</style>

      {links.map((link, i) => {
        const href = fullHref(link.url);
        const videoThumb = videoThumbnail(link.url);
        const embed = videoEmbed(link.url);
        const pv = previews[i];
        const img = videoThumb || pv?.image || null;
        const favicon = pv?.favicon || null;
        const isPlaying = playing === i;
        // First tile goes full-width when the count is odd (link.me's rule);
        // a tile also expands while its video is playing.
        const big = (odd && i === 0) || isPlaying;

        // Inline video player — tile swaps to an autoplaying embed
        if (isPlaying && embed) {
          return (
            <div key={i} className="relative w-full rounded-[14px] overflow-hidden mb-2.5 bg-black" style={{ aspectRatio: "16/9" }}>
              <iframe
                src={embed}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                title={link.label}
              />
              <button
                type="button"
                onClick={() => setPlaying(null)}
                aria-label="Close video"
                className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 text-white/90 text-sm leading-none flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          );
        }

        // A fixed pixel height here (vs a percentage width) forced the tile
        // toward square as the viewport narrowed — on a phone the tile's real
        // aspect ratio drifted far from the ~1.91:1 link-preview image's own
        // ratio, so object-cover had to crop far more off the sides to fill
        // it (cutting off the logo/wordmark). An aspect-ratio box instead of a
        // fixed height keeps width and height scaling together at every
        // viewport, matching the image's natural ratio so it fits without
        // cropping instead of getting cut off.
        const tileClasses = `relative overflow-hidden rounded-[14px] mb-2.5 block group transition-transform active:scale-[0.98] aspect-[1.91/1] ${
          big ? "w-full" : "w-[calc(50%-6px)]"
        }`;

        const inner = (
          <>
            {/* Image (or branded gradient fallback) */}
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length] }}>
                {link.emoji ? (
                  <span className="text-4xl drop-shadow">{link.emoji}</span>
                ) : favicon ? (
                  <span className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={favicon} alt="" className="w-7 h-7 object-contain" />
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2} className="w-9 h-9">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                )}
              </div>
            )}

            {/* Bottom gradient so the title reads over any image */}
            <div className="absolute inset-x-0 bottom-0 h-[70%]" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)" }} />

            {/* Favicon circle, top-left (link.me's iconbox) */}
            {img && (favicon || link.emoji) && (
              <span className="absolute top-2 left-2 z-[6] w-[30px] h-[30px] rounded-full bg-white/95 shadow flex items-center justify-center">
                {favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={favicon} alt="" className="w-[20px] h-[20px] object-contain rounded-full" />
                ) : (
                  <span className="text-[15px] leading-none">{link.emoji}</span>
                )}
              </span>
            )}

            {/* Play button for videos */}
            {videoThumb && (
              <span className="absolute inset-0 z-[6] flex items-center justify-center">
                <span className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-[2px] flex items-center justify-center transition-transform group-hover:scale-110">
                  <svg viewBox="0 0 24 24" fill="#fff" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </span>
            )}

            {/* Centered title at the bottom, 2-line clamp */}
            <span className="absolute inset-x-0 bottom-[7px] z-[6] px-2 flex justify-center">
              <span
                className={`text-white font-semibold text-center leading-[1.3] ${big ? "text-[18px]" : "text-[16px]"}`}
                // Break BETWEEN words (overflow-wrap), never mid-word like the
                // old word-break:break-word did — a whole word only splits if it
                // alone is wider than the tile. The 2-line clamp then ends on a
                // complete word with an ellipsis, so the title always fits its
                // box cleanly and never shows a chopped word.
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "normal", overflowWrap: "break-word", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
              >
                {link.label}
              </span>
            </span>

            {/* Shine sweep */}
            <span className="sc-shine" aria-hidden="true" />
          </>
        );

        // Videos play inline; everything else opens the link.
        if (embed) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => { triggerSignupNudge("link_button"); setPlaying(i); }}
              className={`${tileClasses} text-left`}
              style={{ background: "#242526" }}
            >
              {inner}
            </button>
          );
        }
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerSignupNudge("link_button")}
            className={tileClasses}
            style={{ background: "#242526" }}
          >
            {inner}
          </a>
        );
      })}
    </div>
  );
}
