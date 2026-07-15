import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { buildConnectLinks } from "@/lib/social-url";
import { isPaidPlan, PLAN_LIMITS } from "@/lib/plan";
import { cardIsOffline, cardWithinPlanLimit } from "@/lib/card-active";
import { cardHeadshot } from "@/lib/card-media";
import CardEventTracker from "@/components/CardEventTracker";
import SignupNudgeHost from "@/components/SignupNudgeHost";
import SwiftLinkProfile from "@/components/SwiftLinkProfile";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

async function resolve(username: string) {
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
  let profile = ownerDeleted ? null : (cardRow ?? (legacyOk ? profileRow : null));
  const ownerPlan = (cardRow ? cardOwner?.plan : profileRow?.plan) as string | null | undefined;
  // Office kill-switch: a card taken offline serves no Swift Links page either.
  if (cardIsOffline(cardRow)) profile = null;
  // Plan kill-switch: a Free account's extra (Pro-era) cards serve no Swift
  // Links page either — same rule as the card page, no bypass.
  if (profile && cardRow && !(await cardWithinPlanLimit(cardRow.id, cardRow.user_id, ownerPlan))) {
    profile = null;
  }
  // Per-card headshot: use the card's OWN headshot (customization.photoUrl) and
  // only fall back to the account photo for legacy cards that never set one —
  // so a new card with no headshot never shows another card's picture.
  const photoUrl = cardRow
    ? cardHeadshot(cardRow.customization, cardOwner?.photo_url)
    : (legacyOk ? (profileRow?.photo_url ?? null) : null);
  return { profile, photoUrl, ownerPlan };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const { profile } = await resolve(username);
  if (!profile) return { title: "Swift Links" };
  const name = profile.name || username;
  const description = `Connect with ${name} — all their links in one place.`;
  return {
    title: `${name} — Swift Links`,
    description,
    // Texted /links/ URLs unfurl with the same picture-of-the-card preview the
    // card link gets (iMessage/WhatsApp/SMS), reusing the card's OG image.
    openGraph: {
      title: `${name} — Swift Links`,
      description,
      url: `${APP_URL}/links/${username}`,
      siteName: "SwiftCard",
      images: [{ url: `${APP_URL}/card/${username}/opengraph-image`, width: 1200, height: 686 }],
    },
    twitter: { card: "summary_large_image", title: `${name} — Swift Links`, description },
  };
}

export default async function SwiftLinksPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { username } = await params;
  const { embed } = await searchParams;
  const isEmbed = embed === "1"; // rendered inside the /preview demo — don't log a view or nudge
  const { profile, photoUrl, ownerPlan } = await resolve(username);
  if (!profile) notFound();

  // Don't count the owner viewing their own Swift Links page as a view.
  // getUser() refreshes the Supabase session cookie, which can throw for a
  // public viewer carrying a stale/invalid cookie — a public page must never
  // 500 on that (the card page guards this identically). Default to not-owner.
  const ownerId = (profile as { user_id?: string; id?: string }).user_id ?? (profile as { id?: string }).id;
  let viewer: { id: string } | null = null;
  try {
    ({ data: { user: viewer } } = await (await createClient()).auth.getUser());
  } catch { /* public viewer with a bad cookie — treat as anonymous */ }
  const isOwnerView = !!viewer && viewer.id === ownerId;

  const ownerPaid = isPaidPlan(ownerPlan);
  const customization = (profile.customization ?? {}) as {
    bio?: string;
    facebook?: string;
    snapchat?: string;
    youtube?: string;
    links?: { emoji: string; label: string; url: string }[];
  };
  const bio = customization.bio || "";
  // Free is capped at FREE_MAX_LINKS Swift Links buttons; paid plans get
  // unlimited. Trimmed here so the cap applies to existing accounts on view,
  // not only after their next save.
  const allActionLinks = (customization.links ?? []).filter((l) => l.label && l.url);
  const actionLinks = ownerPaid ? allActionLinks : allActionLinks.slice(0, PLAN_LIMITS.FREE_MAX_LINKS);

  const socials = buildConnectLinks({
    website: profile.website,
    linkedin: profile.linkedin,
    instagram: profile.instagram,
    tiktok: profile.tiktok,
    facebook: customization.facebook,
    twitter: profile.twitter,
    snapchat: customization.snapchat,
    youtube: customization.youtube,
  });

  const subtitle = [profile.title, profile.company].filter(Boolean).join("  ·  ");

  return (
    <>
      {!isEmbed && !isOwnerView && <CardEventTracker username={username} source="swift_links" viewSurface="links" />}
      {!isEmbed && !isOwnerView && <SignupNudgeHost />}
      <SwiftLinkProfile
        name={profile.name || username}
        username={username}
        photoUrl={photoUrl}
        subtitle={subtitle}
        bio={bio}
        verified={ownerPaid}
        socials={socials.map((s) => ({ label: s.label, href: s.href, color: s.color, textColor: s.textColor }))}
        links={actionLinks}
        ownerPaid={ownerPaid}
        appUrl={APP_URL}
      />
    </>
  );
}
