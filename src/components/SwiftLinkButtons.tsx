"use client";

// Featured links, link.me style: any link with a big preview image (video
// thumbnail or og:image) renders as a full-width "clickbait" card — the image
// fills the card and the title sits on a bottom gradient. Links with only a
// favicon render as compact rows; bare links as clean row buttons.

import { useEffect, useState } from "react";
import { videoThumbnail } from "@/lib/video";
import { triggerSignupNudge } from "@/lib/nudge";

type Link = { emoji: string; label: string; url: string };
type Preview = { image: string | null; favicon: string | null; title: string | null };

const SURFACE = "#242526"; // card surface on the dark sheet

function fullHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

export default function SwiftLinkButtons({ links }: { links: Link[] }) {
  // Fetched preview (og:image + favicon fallback) for non-video links, by index.
  const [previews, setPreviews] = useState<Record<number, Preview>>({});

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

  return (
    <div className="w-full flex flex-col gap-3 mt-6">
      {links.map((link, i) => {
        const href = fullHref(link.url);
        const videoThumb = videoThumbnail(link.url);
        const pv = previews[i];
        const bigImg = videoThumb || pv?.image || null;
        const favicon = pv?.favicon || null;
        const title = `${link.emoji ? `${link.emoji} ` : ""}${link.label}`;

        // Featured card — big image with the title on a bottom gradient
        if (bigImg) {
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerSignupNudge("link_button")}
              className="relative block w-full rounded-[20px] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.4)] ring-1 ring-white/10 transition-transform active:scale-[0.985] hover:scale-[1.01]"
              style={{ background: SURFACE }}
            >
              <div className="relative w-full aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bigImg} alt={link.label} className="absolute inset-0 w-full h-full object-cover" />
                {videoThumb && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="#fff" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                )}
                {/* Title on a bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 pt-12 pb-3 px-4 text-left" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)" }}>
                  <span className="block text-white font-bold text-[15px] leading-snug drop-shadow-sm">{title}</span>
                  {pv?.title && pv.title !== link.label && (
                    <span className="block text-white/70 text-[11px] mt-0.5 truncate">{pv.title}</span>
                  )}
                </div>
              </div>
            </a>
          );
        }

        // Compact row — favicon (or emoji) tile + label + chevron
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerSignupNudge("link_button")}
            className="w-full p-2.5 pr-4 rounded-[18px] text-sm text-white ring-1 ring-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-all active:scale-[0.985] hover:ring-white/25 flex items-center gap-3"
            style={{ background: SURFACE }}
          >
            <div className="w-11 h-11 rounded-[13px] overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
              {favicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={favicon} alt="" className="w-6 h-6 object-contain" />
              ) : link.emoji ? (
                <span className="text-xl leading-none">{link.emoji}</span>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-white/70">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              )}
            </div>
            <span className="flex flex-col min-w-0 flex-1 text-left">
              <span className="font-semibold truncate">{link.label}</span>
              {pv?.title && pv.title !== link.label && (
                <span className="text-[11px] font-normal text-white/50 truncate">{pv.title}</span>
              )}
            </span>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-40 shrink-0">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </a>
        );
      })}
    </div>
  );
}
