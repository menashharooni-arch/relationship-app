"use client";

import { triggerSignupNudge } from "@/lib/nudge";

type CardLink = { emoji?: string; label: string; url: string };

// The card's custom "link-in-bio" action buttons. Same look as before — the only
// addition is that tapping one (which opens the link in a NEW tab, leaving the
// card open behind it) invites the visitor to make their own card. The signup
// host shows the invite once per session and never to logged-in users.
export default function CardActionLinks({ links, spaced }: { links: CardLink[]; spaced: boolean }) {
  if (!links.length) return null;
  return (
    <div className={`flex flex-col gap-2${spaced ? " mt-2" : ""}`}>
      {links.map((link, i) => (
        <a
          key={i}
          href={/^https?:\/\//i.test(link.url) ? link.url : `https://${link.url.replace(/^[a-z][a-z0-9+.-]*:\/*/i, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => triggerSignupNudge("link_button")}
          className="flex items-center gap-2.5 w-full py-3.5 px-5 rounded-2xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
          style={{ background: "#FAF7F2", border: "1px solid #E4DDD4", color: "#0f172a" }}
        >
          {link.emoji && <span className="text-base">{link.emoji}</span>}
          {link.label}
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 ml-auto opacity-30">
            <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
          </svg>
        </a>
      ))}
    </div>
  );
}
