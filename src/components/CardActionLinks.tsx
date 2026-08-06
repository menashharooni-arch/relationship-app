"use client";

import { triggerSignupNudge } from "@/lib/nudge";
import LinkMark from "@/components/LinkMark";
import { fullHref, hostLabel, safeAccent, inkOn } from "@/lib/link-brand";

type CardLink = { emoji?: string; label: string; url: string };

// The card's custom "link-in-bio" buttons, in TWO registers instead of one.
//
// Before: every link was an identical full-width cream slab, so "Donate Here!" —
// the entire point of a charity's card — looked exactly like "About Us!". Four
// in a row read as a pile, and the section had no focal point at all.
//
// Now:
//   FEATURE PLATE — the first link, filled with the owner's accent, with the
//     destination host on a second line. That host line is the plate's exclusive
//     privilege and is what makes it a different KIND of object, not a bigger one.
//   STACK TABLE — every other link inside ONE bordered container separated by
//     internal hairlines. This is the highest-yield change in the redesign:
//     N floating buttons read as a pile; one container with rules reads as a
//     designed index. It also survives every count — a one-row table still reads
//     as a plate, which matters because PLAN_LIMITS.FREE_MAX_LINKS is 2, making
//     "feature + exactly one row" the most common shape on the platform.
//
// Zero network: the marks are favicons derived from the hostname (lazy, over an
// always-painted monogram), never an og:image scrape.
export default function CardActionLinks({ links, accent }: { links: CardLink[]; accent?: string | null }) {
  if (!links.length) return null;

  const [feature, ...rest] = links;
  // safeAccent is load-bearing: modern-bold's presets include "#ffffff" and
  // plan.ts snaps a Free card's accent onto that list, so without this the
  // primary button renders invisible on real cards.
  const fill = safeAccent(accent);
  const ink = inkOn(fill);
  const onDark = ink === "#FFFFFF";
  const featureHost = hostLabel(feature.url);

  return (
    <>
      <a
        href={fullHref(feature.url)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => triggerSignupNudge("link_button")}
        className="flex items-center gap-3 w-full min-h-[56px] px-3.5 py-3 rounded-[14px] transition-[transform,filter] duration-150 active:scale-[0.985] active:brightness-[0.97]"
        style={{
          // Flat colour FIRST so a browser that can't parse color-mix degrades to
          // a solid plate rather than a transparent one.
          background: fill,
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${fill} 94%, #fff) 0%, color-mix(in srgb, ${fill} 90%, #000) 100%)`,
          color: ink,
          boxShadow: onDark
            ? "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 1px rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.12)"
            : "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 0 0 1px rgba(15,23,42,0.12), 0 1px 2px rgba(15,23,42,0.10)",
        }}
      >
        <span
          className="shrink-0 w-8 h-8 rounded-[10px] grid place-items-center overflow-hidden"
          style={{
            background: onDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.06)",
            boxShadow: `inset 0 0 0 1px ${onDark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.08)"}`,
          }}
        >
          {feature.emoji ? <span className="text-[15px] leading-none">{feature.emoji}</span> : <LinkMark url={feature.url} size={16} />}
        </span>
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="font-semibold text-[15px] leading-[1.25] tracking-[-0.011em] line-clamp-2 [overflow-wrap:anywhere]">
            {feature.label}
          </span>
          {featureHost && (
            <span className="text-[11px] font-medium leading-[1.4] mt-px truncate lowercase" style={{ opacity: 0.72 }}>
              {featureHost}
            </span>
          )}
        </span>
        {/* A chevron, not a diagonal external-link arrow: diagonal says "you are
            leaving", chevron says "continue". */}
        <span
          className="shrink-0 w-[22px] h-[22px] rounded-full grid place-items-center"
          style={{ background: onDark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.07)" }}
        >
          <Chevron className="w-3 h-3 opacity-90" />
        </span>
      </a>

      {rest.length > 0 && (
        <div
          className="mt-2 rounded-[14px] overflow-hidden bg-white"
          style={{ boxShadow: "inset 0 0 0 1px #E7E0D7, 0 1px 2px rgba(15,23,42,0.04)" }}
        >
          {rest.map((l, i) => (
            <a
              key={i}
              href={fullHref(l.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerSignupNudge("link_button")}
              // active:bg, NOT a transform — a row inside a shared container must
              // never move independently of its neighbours.
              className="flex items-center gap-3 min-h-[52px] px-3.5 py-2.5 border-b border-[#F1EBE3] last:border-b-0 transition-colors active:bg-[#FBF9F6]"
            >
              <span
                className="shrink-0 w-7 h-7 rounded-[8px] bg-[#FAF7F2] grid place-items-center overflow-hidden"
                style={{ boxShadow: "inset 0 0 0 1px #EDE6DC" }}
              >
                {l.emoji ? <span className="text-[13px] leading-none">{l.emoji}</span> : <LinkMark url={l.url} size={14} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.006em] text-[#1E293B]">
                {l.label}
              </span>
              <Chevron className="w-3 h-3 shrink-0 text-[#C9BFB2]" />
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M7.7 4.3a1 1 0 000 1.4L12 10l-4.3 4.3a1 1 0 101.4 1.4l5-5a1 1 0 000-1.4l-5-5a1 1 0 00-1.4 0z" />
    </svg>
  );
}
