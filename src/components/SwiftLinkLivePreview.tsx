"use client";

import CardScaler from "@/components/CardScaler";
import InertPreview from "@/components/InertPreview";
import SwiftLinkProfile from "@/components/SwiftLinkProfile";
import { buildConnectLinks } from "@/lib/social-url";
import { PLAN_LIMITS } from "@/lib/plan";
import { freeSafeLook } from "@/lib/swiftlink-looks";
import type { SwiftLinkStyle } from "@/components/SwiftLinkDesign";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// The EXACT Swift Links page, rendered as a live preview. It renders the real
// SwiftLinkProfile (embedded mode) — the same hero, full bio, real brand-colored
// social icons (SocialIcons) and real featured-link cards (SwiftLinkButtons) the
// published page uses — scaled from true phone width down into the preview slot.
// So there is zero drift: a long bio isn't clamped, every social shows (no
// "+N"), and additional links look identical to the live page. Inert + scaled;
// never captures a lead or navigates.

type PreviewSocials = {
  instagram?: string | null;
  tiktok?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  snapchat?: string | null;
  youtube?: string | null;
  website?: string | null;
};

export default function SwiftLinkLivePreview({
  name,
  handle,
  company,
  title,
  bio,
  photoUrl,
  logoUrl,
  socials,
  links,
  style,
  paid = false,
  showCardLink = true,
}: {
  name: string;
  handle: string;
  company?: string | null;
  title?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  /** Card logo — the hero falls back to it when there is no headshot. */
  logoUrl?: string | null;
  socials: PreviewSocials;
  links: { label: string; url: string; emoji?: string; size?: "featured" | "grid" | "compact"; kind?: "link" | "header" }[];
  /** The owner's "Social design" (linkBgColor/linkTextColor/linkFontFamily). */
  style?: SwiftLinkStyle;
  /** Paid owner → page theming + verified badge apply, matching the live page. */
  paid?: boolean;
  /** Mirrors the owner's "View SwiftCard" toggle so the preview is exact. */
  showCardLink?: boolean;
}) {
  const brandSocials = buildConnectLinks({
    website: socials.website ?? undefined,
    linkedin: socials.linkedin ?? undefined,
    instagram: socials.instagram ?? undefined,
    tiktok: socials.tiktok ?? undefined,
    facebook: socials.facebook ?? undefined,
    twitter: socials.twitter ?? undefined,
    snapchat: socials.snapchat ?? undefined,
    youtube: socials.youtube ?? undefined,
  }).map((s) => ({ label: s.label, href: s.href, color: s.color, textColor: s.textColor }));

  const subtitle = [title, company].filter(Boolean).join("  ·  ");
  // The Look previews for EVERY plan — Free's pick of the free pair is real
  // and must preview truthfully (a Free pick that previewed live but was
  // stripped on save is the exact audit bug the custom pickers had). Free's
  // look is snapped the same way the live page snaps it; the Pro fine-tune
  // keys preview only when paid, matching the server.
  const pageStyle = {
    look: paid ? style?.linkLook : freeSafeLook(style?.linkLook),
    // Header style + content + uploaded header photo are every-plan
    // (structural), so they preview for Free too.
    heroImage: style?.linkHeroImage,
    heroStyle: style?.linkHeroStyle,
    heroContent: style?.linkHeroContent,
    ...(paid ? { bg: style?.linkBgColor, text: style?.linkTextColor, font: style?.linkFontFamily, iconShape: style?.linkIconShape, iconFill: style?.linkIconFill, buttonStyle: style?.linkButtonStyle, buttonColor: style?.linkButtonColor } : {}),
  };

  // Only real, filled links carry to the page (same filter the live page uses),
  // with an emoji default so the tile fallback still renders.
  const allCleanLinks = (links ?? [])
    .filter((l) => (l.kind === "header" ? (l.label || "").trim() : (l.label || "").trim() && (l.url || "").trim()))
    .map((l) => ({ emoji: l.emoji ?? "", label: l.label, url: l.url, size: l.size, kind: l.kind }));
  // Free is capped at FREE_MAX_LINKS on the LIVE page, which trims on view — so
  // a Pro→Free downgrade with more saved links saw a preview promising buttons
  // the public page doesn't render. Mirror the cap here.
  const cleanLinks = paid
    ? allCleanLinks
    : allCleanLinks.filter((l) => l.kind !== "header").slice(0, PLAN_LIMITS.FREE_MAX_LINKS);

  return (
    // w-full is load-bearing, not cosmetic. CardScaler's outer div is w-full
    // with contain:size, so it contributes ZERO intrinsic width — this frame
    // must take its width from the PARENT, never from its content. In a block
    // container (card editor, wizard) a div fills the parent anyway, but the
    // homepage mini-builder modal centers its preview in a flex column, where a
    // width-less div shrink-wraps its (zero-width) content: frame 0×0, scale 0,
    // opacity 0 — the whole live preview rendered invisibly while the caption
    // under it still showed. The signature builder never hit this because its
    // preview wrapper carries an explicit w-[280px]; this is the same pattern.
    <InertPreview className="w-full rounded-[30px] overflow-hidden shadow-2xl">
      {/* Phone width (390) so fixed px sizing renders at true proportions, then
          scaled to whatever slot holds the preview. */}
      <CardScaler natural={390}>
        <SwiftLinkProfile
          embedded
          name={name || "Your Name"}
          username={handle || "yourname"}
          photoUrl={photoUrl || null}
          logoUrl={logoUrl || null}
          subtitle={subtitle}
          bio={bio || ""}
          verified={paid}
          paidTiles={paid}
          socials={brandSocials}
          links={cleanLinks}
          appUrl={APP_URL}
          pageStyle={pageStyle}
          showCardLink={showCardLink}
          // Mirrors the live page: the "Made with swiftcard.me" footer is
          // Free-only, so a paid owner's preview must not show it either.
          brandingFooter={!paid}
        />
      </CardScaler>
    </InertPreview>
  );
}
