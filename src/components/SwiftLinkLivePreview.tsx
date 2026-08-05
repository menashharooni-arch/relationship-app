"use client";

import CardScaler from "@/components/CardScaler";
import InertPreview from "@/components/InertPreview";
import SwiftLinkProfile from "@/components/SwiftLinkProfile";
import { buildConnectLinks } from "@/lib/social-url";
import { PLAN_LIMITS } from "@/lib/plan";
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
  links: { label: string; url: string; emoji?: string }[];
  /** The owner's "Social design" (linkBgColor/linkTextColor/linkFontFamily). */
  style?: SwiftLinkStyle;
  /** Paid owner → page theming + verified badge apply, matching the live page. */
  paid?: boolean;
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
  const pageStyle = paid
    ? { bg: style?.linkBgColor, text: style?.linkTextColor, font: style?.linkFontFamily }
    : undefined;

  // Only real, filled links carry to the page (same filter the live page uses),
  // with an emoji default so the tile fallback still renders.
  const allCleanLinks = (links ?? [])
    .filter((l) => (l.label || "").trim() && (l.url || "").trim())
    .map((l) => ({ emoji: l.emoji ?? "", label: l.label, url: l.url }));
  // Free is capped at FREE_MAX_LINKS on the LIVE page, which trims on view — so
  // a Pro→Free downgrade with more saved links saw a preview promising buttons
  // the public page doesn't render. Mirror the cap here.
  const cleanLinks = paid ? allCleanLinks : allCleanLinks.slice(0, PLAN_LIMITS.FREE_MAX_LINKS);

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
          socials={brandSocials}
          links={cleanLinks}
          ownerPaid={paid}
          appUrl={APP_URL}
          pageStyle={pageStyle}
        />
      </CardScaler>
    </InertPreview>
  );
}
