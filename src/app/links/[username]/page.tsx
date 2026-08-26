import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { buildConnectLinks } from "@/lib/social-url";
import { isPaidPlan, PLAN_LIMITS } from "@/lib/plan";
import { freeSafeLook } from "@/lib/swiftlink-looks";
import { cardIsOffline, cardWithinPlanLimit } from "@/lib/card-active";
import { cardHeadshot } from "@/lib/card-media";
import CardEventTracker from "@/components/CardEventTracker";
import SignupNudgeHost from "@/components/SignupNudgeHost";
import SwiftLinkProfile from "@/components/SwiftLinkProfile";
import ReportCardLink from "@/components/ReportCardLink";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// cache() dedupes this across generateMetadata and the page body within the
// same request — both call resolve() with the same username, and without
// this each Swift Links view paid for the cards/profiles/plan-limit lookups
// twice (performance audit).
const resolve = cache(async (username: string) => {
  const admin = getAdminSupabase();
  const { data: cardRow } = await admin.from("cards").select("*").eq("username", username).maybeSingle();
  const { data: cardOwner } = cardRow
    ? await admin.from("profiles").select("photo_url, customization, plan").eq("id", cardRow.user_id).maybeSingle()
    : { data: null };
  const { data: profileRow } = !cardRow
    ? await admin.from("profiles").select("*").eq("username", username).maybeSingle()
    : { data: null };
  const legacyOk = !!profileRow && !((profileRow.customization as { _migrated?: boolean } | null)?._migrated) && !!profileRow.name;
  const ownerDeleted = cardRow
    ? !!((cardOwner?.customization as { _deleted?: boolean } | null)?._deleted)
    : !!((profileRow?.customization as { _deleted?: boolean } | null)?._deleted);
  // The CARD row whenever one exists — every rendered field (bio, socials,
  // links, styling) is per-card, so a user with several cards gets several
  // independent Swift Links pages. It falls back to the profile row ONLY for
  // legacy accounts that predate the cards table and never migrated. Named for
  // what it holds rather than "profile": reading account-level customization
  // here is what caused the headshot to bleed between cards once already.
  let cardOrLegacy = ownerDeleted ? null : (cardRow ?? (legacyOk ? profileRow : null));
  const ownerPlan = (cardRow ? cardOwner?.plan : profileRow?.plan) as string | null | undefined;
  // Office kill-switch: a card taken offline serves no Swift Links page either.
  if (cardIsOffline(cardRow)) cardOrLegacy = null;
  // Plan kill-switch: a Free account's extra (Pro-era) cards serve no Swift
  // Links page either — same rule as the card page, no bypass.
  if (cardOrLegacy && cardRow && !(await cardWithinPlanLimit(cardRow.id, cardRow.user_id, ownerPlan))) {
    cardOrLegacy = null;
  }
  // Per-card headshot: use the card's OWN headshot (customization.photoUrl) and
  // only fall back to the account photo for legacy cards that never set one —
  // so a new card with no headshot never shows another card's picture.
  const photoUrl = cardRow
    ? cardHeadshot(cardRow.customization, cardOwner?.photo_url)
    : (legacyOk ? (profileRow?.photo_url ?? null) : null);
  return { cardOrLegacy, photoUrl, ownerPlan };
});

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username: rawUsername } = await params;
  const username = rawUsername.toLowerCase();
  const { cardOrLegacy } = await resolve(username);
  if (!cardOrLegacy) return { title: "Swift Links", itunes: null };
  const name = cardOrLegacy.name || username;
  const description = `Connect with ${name} — all their links in one place.`;
  return {
    title: `${name} — Swift Links`,
    description,
    // Recipient surface — no Smart App Banner, same reasoning as the card page.
    itunes: null,
    // Texted /links/ URLs unfurl with the same picture-of-the-card preview the
    // card link gets (iMessage/WhatsApp/SMS), reusing the card's OG image.
    openGraph: {
      title: `${name} — Swift Links`,
      description,
      url: `${APP_URL}/links/${username}`,
      siteName: "SwiftCard",
      images: [{ url: `${APP_URL}/${username}/opengraph-image`, width: 1200, height: 686 }],
    },
    twitter: { card: "summary_large_image", title: `${name} — Swift Links`, description },
  };
}

export default async function SwiftLinksPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ embed?: string; source?: string | string[] }> }) {
  const { username: rawUsername } = await params;
  const username = rawUsername.toLowerCase();
  const { embed, source: rawSource } = await searchParams;
  const isEmbed = embed === "1"; // rendered inside the /preview demo — don't log a view or nudge
  // Real traffic-source attribution, like the card page: a QR/NFC tag pointing
  // at /links/<slug>?source=qr_code used to be flattened to "swift_links", so
  // a Swift Links scan could never appear in the scans metric. The surface is
  // carried separately (viewSurface="links"), so the source no longer has to
  // double as one.
  const sourceParam = Array.isArray(rawSource) ? rawSource[0] : rawSource;
  const source = (sourceParam ?? "swift_links").slice(0, 48);
  const { cardOrLegacy, photoUrl, ownerPlan } = await resolve(username);
  if (!cardOrLegacy) notFound();

  // Don't count the owner viewing their own Swift Links page as a view.
  // getUser() refreshes the Supabase session cookie, which can throw for a
  // public viewer carrying a stale/invalid cookie — a public page must never
  // 500 on that (the card page guards this identically). Default to not-owner.
  const ownerId = (cardOrLegacy as { user_id?: string; id?: string }).user_id ?? (cardOrLegacy as { id?: string }).id;
  let viewer: { id: string } | null = null;
  try {
    ({ data: { user: viewer } } = await (await createClient()).auth.getUser());
  } catch { /* public viewer with a bad cookie — treat as anonymous */ }
  const isOwnerView = !!viewer && viewer.id === ownerId;

  const ownerPaid = isPaidPlan(ownerPlan);
  const customization = (cardOrLegacy.customization ?? {}) as {
    bio?: string;
    facebook?: string;
    snapchat?: string;
    youtube?: string;
    links?: { emoji: string; label: string; url: string; size?: "featured" | "grid" | "compact"; kind?: "link" | "header" }[];
    // "Social design" — the page's named Look (every plan) + Pro fine-tuning.
    linkLook?: string;
    linkBgColor?: string;
    linkTextColor?: string;
    linkFontFamily?: string;
    linkIconShape?: string;
    linkIconFill?: string;
  };
  // The named Look renders for EVERY plan — Free is snapped to the free pair
  // at render time (a Pro Look kept in storage after a downgrade is hidden,
  // never deleted, same philosophy as the links cap below). The custom
  // fine-tune keys stay paid-only, matching sanitizeCustomizationForPlan.
  const pageStyle = {
    look: ownerPaid ? customization.linkLook : freeSafeLook(customization.linkLook),
    ...(ownerPaid
      ? {
          bg: customization.linkBgColor,
          text: customization.linkTextColor,
          font: customization.linkFontFamily,
          iconShape: customization.linkIconShape,
          iconFill: customization.linkIconFill,
        }
      : {}),
  };
  const bio = customization.bio || "";
  // Free is capped at FREE_MAX_LINKS Swift Links buttons; paid plans get
  // unlimited. Trimmed here so the cap applies to existing accounts on view,
  // not only after their next save.
  // Array.isArray, not `?? []`: a corrupted/legacy customization where `links`
  // is an object or string would throw on .filter and 500 this PUBLIC page.
  // Same guard the card page already applies (cards audit M4).
  // Headers (kind:"header") are label-only rows — kept for paid owners, and
  // never counted against the Free links cap (they're organization, not
  // links; layoutTiles drops them from the Free rendering anyway).
  const allActionLinks = (Array.isArray(customization.links) ? customization.links : [])
    .filter((l) => (l.kind === "header" ? !!l.label : l.label && l.url));
  const actionLinks = ownerPaid
    ? allActionLinks
    : allActionLinks.filter((l) => l.kind !== "header").slice(0, PLAN_LIMITS.FREE_MAX_LINKS);

  const socials = buildConnectLinks({
    website: cardOrLegacy.website,
    linkedin: cardOrLegacy.linkedin,
    instagram: cardOrLegacy.instagram,
    tiktok: cardOrLegacy.tiktok,
    facebook: customization.facebook,
    twitter: cardOrLegacy.twitter,
    snapchat: customization.snapchat,
    youtube: customization.youtube,
  });

  const subtitle = [cardOrLegacy.title, cardOrLegacy.company].filter(Boolean).join("  ·  ");

  return (
    <>
      {/* The RESOLVED slug, not the raw route param — a case/alias divergence
          would otherwise record rows under a key the dashboard never reads. */}
      {!isEmbed && !isOwnerView && <CardEventTracker username={(cardOrLegacy.username as string) || username} source={source} viewSurface="links" />}
      {!isEmbed && !isOwnerView && <SignupNudgeHost cardUsername={(cardOrLegacy.username as string) || username} />}
      <SwiftLinkProfile
        name={cardOrLegacy.name || username}
        username={username}
        photoUrl={photoUrl}
        // Per-card logo, read off the SAME row the headshot comes from, so a
        // card with no headshot leads with its own logo and never another
        // card's (the bleed that cardHeadshot exists to prevent).
        logoUrl={(cardOrLegacy.logo_url as string | null) ?? null}
        subtitle={subtitle}
        bio={bio}
        verified={ownerPaid}
        paidTiles={ownerPaid}
        socials={socials.map((s) => ({ label: s.label, href: s.href, color: s.color, textColor: s.textColor }))}
        links={actionLinks}
        appUrl={APP_URL}
        pageStyle={pageStyle}
      />
      {/* In-app only (App Review 1.2): report affordance for public Swift
          Links pages. Renders null on web/SSR — the public page is unchanged. */}
      <ReportCardLink username={username} />
    </>
  );
}
