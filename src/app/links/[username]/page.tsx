import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { buildConnectLinks } from "@/lib/social-url";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";
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
  const profile = ownerDeleted ? null : (cardRow ?? (legacyOk ? profileRow : null));
  const photoUrl = cardRow ? (cardOwner?.photo_url ?? null) : (legacyOk ? (profileRow?.photo_url ?? null) : null);
  const ownerPlan = (cardRow ? cardOwner?.plan : profileRow?.plan) as string | null | undefined;
  return { profile, photoUrl, ownerPlan };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const { profile } = await resolve(username);
  if (!profile) return { title: "Swift Links" };
  const name = profile.name || username;
  return { title: `${name} — Swift Links`, description: `Connect with ${name}.` };
}

export default async function SwiftLinksPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { username } = await params;
  const { embed } = await searchParams;
  const isEmbed = embed === "1"; // rendered inside the /preview demo — don't log a view or nudge
  const { profile, photoUrl, ownerPlan } = await resolve(username);
  if (!profile) notFound();

  // Don't count the owner viewing their own Swift Links page as a view.
  const ownerId = (profile as { user_id?: string; id?: string }).user_id ?? (profile as { id?: string }).id;
  const { data: { user: viewer } } = await (await createClient()).auth.getUser();
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
  // Free shows up to FREE_SWIFTLINK_BUTTONS buttons; Pro/Office unlimited.
  const allLinks = (customization.links ?? []).filter((l) => l.label && l.url);
  const actionLinks = ownerPaid ? allLinks : allLinks.slice(0, PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS);

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
      {!isEmbed && <SignupNudgeHost />}
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
