"use client";

import { useEffect, useState } from "react";
import { videoThumbnail } from "@/lib/video";
import { triggerSignupNudge } from "@/lib/nudge";

type Link = { emoji: string; label: string; url: string };

function fullHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

export default function SwiftLinkButtons({ links }: { links: Link[] }) {
  // Fetched Open Graph images for non-video links (index → image url | null).
  const [previews, setPreviews] = useState<Record<number, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    links.forEach((link, i) => {
      if (videoThumbnail(link.url)) return; // video handled instantly below
      fetch(`/api/link-preview?url=${encodeURIComponent(fullHref(link.url))}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setPreviews((p) => ({ ...p, [i]: d.image || null })); })
        .catch(() => { if (!cancelled) setPreviews((p) => ({ ...p, [i]: null })); });
    });
    return () => { cancelled = true; };
  }, [links]);

  if (!links.length) return null;

  return (
    <div className="w-full flex flex-col gap-2 mt-5">
      {links.map((link, i) => {
        const href = fullHref(link.url);
        const videoThumb = videoThumbnail(link.url);
        const thumb = videoThumb || previews[i];

        if (thumb) {
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerSignupNudge("link_button")}
              className="w-full p-2 pr-4 rounded-2xl text-sm text-white border border-white/15 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur flex items-center gap-3"
            >
              <div className="relative w-20 h-12 rounded-xl overflow-hidden shrink-0 bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb} alt={link.label} className="w-full h-full object-cover" />
                {videoThumb && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-black/55 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="#fff" className="w-3.5 h-3.5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                )}
              </div>
              <span className="font-semibold truncate flex-1 text-left">{link.label}</span>
            </a>
          );
        }

        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerSignupNudge("link_button")}
            className="w-full py-3 px-5 rounded-2xl font-semibold text-sm text-white border border-white/15 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur flex items-center justify-between"
          >
            <span className="truncate">{link.label}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 opacity-50 shrink-0 ml-2">
              <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
            </svg>
          </a>
        );
      })}
    </div>
  );
}
