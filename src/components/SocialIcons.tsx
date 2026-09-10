"use client";

import { useEffect, useState } from "react";
import PlatformIcon from "@/components/PlatformIcon";
import { brandBackground } from "@/lib/link-brand";
import { triggerSignupNudge } from "@/lib/nudge";
import { trackLinkClick } from "@/lib/track-link-click";

export type BrandSocial = { label: string; href: string; color?: string; textColor?: string };

// Official-feeling brand backgrounds for the icon tiles (link.me style).
// Instagram gets its signature gradient; the rest use the platform color.
// Moved to lib/link-brand so the card page's disc rail renders the identical
// Instagram gradient. Behaviour here is unchanged.

// Build a native-app deep link from the web profile URL, when the app supports one.
// Returns null for platforms without a reliable scheme (we just use the web URL).
function appScheme(label: string, href: string): string | null {
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  const parts = u.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  switch (label) {
    case "Instagram":
      return last ? `instagram://user?username=${last}` : null;
    case "LinkedIn": {
      const i = parts.indexOf("in");
      if (i >= 0 && parts[i + 1]) return `linkedin://in/${parts[i + 1]}`;
      const c = parts.indexOf("company");
      if (c >= 0 && parts[c + 1]) return `linkedin://company/${parts[c + 1]}`;
      return null;
    }
    case "X / Twitter":
      return last ? `twitter://user?screen_name=${last}` : null;
    case "Snapchat": {
      const a = parts.indexOf("add");
      if (a >= 0 && parts[a + 1]) return `snapchat://add/${parts[a + 1]}`;
      return last ? `snapchat://add/${last}` : null;
    }
    case "Facebook":
      return `fb://facewebmodal/f?href=${encodeURIComponent(href)}`;
    default:
      return null; // TikTok / YouTube / Website → web is fine
  }
}

function navigateTo(url: string) {
  window.location.href = url;
}

export default function SocialIcons({
  socials,
  mode = "dark",
  shape = "circle",
  fill = "brand",
  accent = "#1D4ED8",
  accentText = "#FFFFFF",
  trackFor = null,
  trackSurface = "links",
  trackSource = "swift_links",
  suppressTracking = false,
}: {
  socials: BrandSocial[];
  /** The surface the row sits on — adapts the NEUTRAL chrome (ring, shadow,
   *  and the mono fill's chip color). Defaults keep pre-Looks callers
   *  byte-for-byte as before. */
  mode?: "light" | "dark";
  /** Chip geometry (hoo.be-style): circle / squircle / square. */
  shape?: "circle" | "squircle" | "square";
  /** Chip color: per-platform brand colors, the Look's accent, or quiet
   *  neutral chips. */
  fill?: "brand" | "accent" | "mono";
  accent?: string;
  accentText?: string;
  /** The CARD SLUG these chips belong to. Null (the default) records nothing —
   *  this row is reused by the marketing mocks and the live designer, so
   *  tracking is opt-in, never opt-out. */
  trackFor?: string | null;
  /** Which page the chip was pressed on. */
  trackSurface?: "card" | "links";
  /** The page's own ?source= attribution, inherited by the tap. */
  trackSource?: string;
  /** Owner looking at their own page. */
  suppressTracking?: boolean;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1); // iPadOS reports as Mac
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time environment check on mount
    setIsMobile(mobile);
  }, []);

  // On mobile: try to open the native app; if it doesn't take over, fall back to web.
  function handle(e: React.MouseEvent, s: BrandSocial) {
    // A social-chip tap is the same incidental moment as a link-tile tap
    // (2026-08-19 popup audit: chips were the ONE tap that never invited the
    // visitor). Shares the link_button slot, so a visitor who taps a chip AND
    // a tile still sees at most one incidental nudge per session, and the
    // marketing mock is unaffected (no SignupNudgeHost mounted there).
    // A chip tap is an outbound link tap. Recorded through the SAME canonical
    // route as views and downloads — and as a beacon, because the app-scheme
    // handoff below replaces this document and an ordinary fetch would be
    // cancelled with it (lib/track-link-click.ts).
    trackLinkClick({ username: trackFor, surface: trackSurface, url: s.href, source: trackSource, suppress: suppressTracking });
    triggerSignupNudge("link_button");
    if (!isMobile) return; // desktop: normal new-tab behavior
    const scheme = appScheme(s.label, s.href);
    if (!scheme) return; // no app scheme: normal web behavior
    e.preventDefault();
    const fallback = setTimeout(() => navigateTo(s.href), 1200);
    const onHide = () => { if (document.hidden) clearTimeout(fallback); }; // app opened → cancel
    document.addEventListener("visibilitychange", onHide, { once: true });
    navigateTo(scheme);
  }

  if (!socials.length) return null;

  // ONE line, always (owner order 2026-09-02): the row never wraps — as more
  // networks are added the chips shrink together so all of them share the
  // line. Up to 4 chips renders byte-for-byte as before (54px, 12px gaps —
  // the marketing mocks that reuse this row show ≤4 and are unchanged). Past
  // that, the gap tightens and each chip's width is the space left divided
  // evenly, capped at 54px and never below 30px (8 chips — every network we
  // support — fits a 288px column at 30px). aspect-square keeps chips round;
  // the icon and the squircle/square radii scale in percentages so a small
  // chip is the same drawing, only smaller.
  const n = socials.length;
  const gap = n <= 4 ? 12 : n <= 6 ? 8 : 6;
  const chipWidth = `clamp(30px, calc((100% - ${(n - 1) * gap}px) / ${n}), 54px)`;

  return (
    <div className="flex flex-nowrap items-center justify-center mt-5" style={{ gap }}>
      {socials.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          onClick={(e) => handle(e, s)}
          className={`aspect-square shrink-0 flex items-center justify-center ring-1 transition-transform active:scale-95 hover:scale-105 ${
            shape === "circle" ? "rounded-full" : shape === "squircle" ? "rounded-[33%]" : "rounded-[15%]"
          } ${
            mode === "light"
              ? "shadow-[0_4px_14px_rgba(15,23,42,0.16)] ring-black/[0.08]"
              : "shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-white/10"
          }`}
          style={{
            width: chipWidth,
            ...(fill === "accent"
              ? { background: accent, color: accentText }
              : fill === "mono"
                ? mode === "light"
                  ? { background: "#FFFFFF", color: "#111827" }
                  : { background: "rgba(255,255,255,0.10)", color: "#FFFFFF" }
                : { background: brandBackground(s.label, s.color), color: s.textColor || "#fff" }),
          }}
        >
          <PlatformIcon label={s.label} className="w-[46%] h-[46%]" />
        </a>
      ))}
    </div>
  );
}
