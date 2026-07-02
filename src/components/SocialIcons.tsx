"use client";

import { useEffect, useState } from "react";
import PlatformIcon from "@/components/PlatformIcon";

export type BrandSocial = { label: string; href: string; color?: string; textColor?: string };

// Official-feeling brand backgrounds for the icon tiles (link.me style).
// Instagram gets its signature gradient; the rest use the platform color.
function brandBackground(label: string, color?: string): string {
  if (label === "Instagram") {
    return "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)";
  }
  return color || "rgba(255,255,255,0.1)";
}

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

export default function SocialIcons({ socials }: { socials: BrandSocial[] }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1); // iPadOS reports as Mac
    setIsMobile(mobile);
  }, []);

  // On mobile: try to open the native app; if it doesn't take over, fall back to web.
  function handle(e: React.MouseEvent, s: BrandSocial) {
    if (!isMobile) return; // desktop: normal new-tab behavior
    const scheme = appScheme(s.label, s.href);
    if (!scheme) return; // no app scheme: normal web behavior
    e.preventDefault();
    const fallback = setTimeout(() => { window.location.href = s.href; }, 1200);
    const onHide = () => { if (document.hidden) clearTimeout(fallback); }; // app opened → cancel
    document.addEventListener("visibilitychange", onHide, { once: true });
    window.location.href = scheme;
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
          className="w-[54px] h-[54px] rounded-full flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-1 ring-white/10 transition-transform active:scale-95 hover:scale-105"
          style={{ background: brandBackground(s.label, s.color), color: s.textColor || "#fff" }}
        >
          <PlatformIcon label={s.label} className="w-6 h-6" />
        </a>
      ))}
    </div>
  );
}
