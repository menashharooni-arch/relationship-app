"use client";

import { useEffect, useState } from "react";
import PlatformIcon from "@/components/PlatformIcon";
import { brandBackground } from "@/lib/link-brand";
import { triggerSignupNudge } from "@/lib/nudge";

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

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
      {socials.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          onClick={(e) => handle(e, s)}
          className={`w-[54px] h-[54px] flex items-center justify-center ring-1 transition-transform active:scale-95 hover:scale-105 ${
            shape === "circle" ? "rounded-full" : shape === "squircle" ? "rounded-[18px]" : "rounded-[8px]"
          } ${
            mode === "light"
              ? "shadow-[0_4px_14px_rgba(15,23,42,0.16)] ring-black/[0.08]"
              : "shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-white/10"
          }`}
          style={
            fill === "accent"
              ? { background: accent, color: accentText }
              : fill === "mono"
                ? mode === "light"
                  ? { background: "#FFFFFF", color: "#111827" }
                  : { background: "rgba(255,255,255,0.10)", color: "#FFFFFF" }
                : { background: brandBackground(s.label, s.color), color: s.textColor || "#fff" }
          }
        >
          <PlatformIcon label={s.label} className="w-6 h-6" />
        </a>
      ))}
    </div>
  );
}
