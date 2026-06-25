// Build a valid profile URL from whatever was stored: a full URL, a platform URL
// (e.g. "instagram.com/x"), an "@handle", or a bare handle.
export function socialUrl(platform: string, raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;

  const lower = v.toLowerCase();
  const domain: Record<string, string> = {
    linkedin: "linkedin.com",
    instagram: "instagram.com",
    twitter: "x.com",
    tiktok: "tiktok.com",
    facebook: "facebook.com",
    snapchat: "snapchat.com",
    youtube: "youtube.com",
  };
  if ((domain[platform] && lower.includes(domain[platform])) || (platform === "twitter" && lower.includes("twitter.com"))) {
    return `https://${v.replace(/^\/+/, "")}`;
  }

  const handle = v.replace(/^@+/, "").trim();
  if (!handle) return null;

  switch (platform) {
    case "linkedin":
      if (/^(in|company|pub|school)\//i.test(handle)) return `https://linkedin.com/${handle}`;
      return `https://linkedin.com/in/${handle}`;
    case "instagram": return `https://instagram.com/${handle}`;
    case "twitter":   return `https://x.com/${handle}`;
    case "tiktok":    return `https://tiktok.com/@${handle}`;
    case "facebook":  return `https://facebook.com/${handle}`;
    case "snapchat":  return `https://snapchat.com/add/${handle}`;
    case "youtube":   return `https://youtube.com/@${handle}`;
    case "website":   return /\.[a-z]{2,}/i.test(handle) ? `https://${handle.replace(/^\/+/, "")}` : null;
    default:          return `https://${handle}`;
  }
}

export function handleLabel(raw?: string | null): string {
  return (raw || "").trim().replace(/^https?:\/\//i, "");
}

export type ConnectLink = { label: string; href: string; sub?: string; color: string; textColor?: string };

// Socials in the canonical order: Website, LinkedIn, Instagram, TikTok, Facebook, X, Snapchat, YouTube.
export function buildConnectLinks(s: {
  website?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  twitter?: string | null;
  snapchat?: string | null;
  youtube?: string | null;
}): ConnectLink[] {
  return [
    { label: "Website",     href: socialUrl("website", s.website),     sub: handleLabel(s.website),     color: "#1D4ED8" },
    { label: "LinkedIn",    href: socialUrl("linkedin", s.linkedin),   sub: handleLabel(s.linkedin),    color: "#0A66C2" },
    { label: "Instagram",   href: socialUrl("instagram", s.instagram), sub: handleLabel(s.instagram),   color: "#E1306C" },
    { label: "TikTok",      href: socialUrl("tiktok", s.tiktok),       sub: handleLabel(s.tiktok),      color: "#010101" },
    { label: "Facebook",    href: socialUrl("facebook", s.facebook),   sub: handleLabel(s.facebook),    color: "#1877F2" },
    { label: "X / Twitter", href: socialUrl("twitter", s.twitter),     sub: handleLabel(s.twitter),     color: "#000000" },
    { label: "Snapchat",    href: socialUrl("snapchat", s.snapchat),   sub: handleLabel(s.snapchat),    color: "#FFCA28", textColor: "#1a1a00" },
    { label: "YouTube",     href: socialUrl("youtube", s.youtube),     sub: handleLabel(s.youtube),     color: "#FF0000" },
  ].filter((l) => l.href) as ConnectLink[];
}
