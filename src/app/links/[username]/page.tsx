import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { buildConnectLinks } from "@/lib/social-url";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";
import PlatformIcon from "@/components/PlatformIcon";
import ConnectButton from "@/components/ConnectButton";
import CardEventTracker from "@/components/CardEventTracker";
import SwiftLinkButtons from "@/components/SwiftLinkButtons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

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

export default async function SwiftLinksPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { profile, photoUrl, ownerPlan } = await resolve(username);
  if (!profile) notFound();

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

  const firstName = profile.name?.split(" ")[0] || username;
  const subtitle = [profile.title, profile.company].filter(Boolean).join("  ·  ");

  return (
    <main
      className="min-h-[100dvh] w-full overflow-y-auto relative flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "linear-gradient(160deg, #0B1020 0%, #181538 55%, #2A2466 100%)" }}
    >
      <CardEventTracker username={username} source="swift_links" viewSurface="links" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-24 -left-20 w-72 h-72 rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 rounded-full blur-3xl opacity-25" style={{ background: "radial-gradient(circle, #ec4899, transparent 70%)" }} />

      <div className="relative w-full max-w-sm flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="rounded-full p-[2px] mb-4" style={{ background: "linear-gradient(135deg, #818cf8, #ec4899)" }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={profile.name || ""} className="w-24 h-24 rounded-full object-cover block" />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ background: "#1e1b4b" }}>
              {profile.name ? initials(profile.name) : "SC"}
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight">{profile.name || username}</h1>
        {subtitle && <p className="text-indigo-200/70 text-sm mt-1">{subtitle}</p>}

        {bio && <p className="text-white/70 text-sm leading-relaxed mt-3 max-w-xs whitespace-pre-wrap">{bio}</p>}

        {/* Connect */}
        <div className="w-full mt-5">
          <ConnectButton cardOwner={username} ownerFirstName={firstName} />
        </div>

        {/* Social icons */}
        {socials.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white border border-white/15 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur"
              >
                <PlatformIcon label={s.label} className="w-[22px] h-[22px]" />
              </a>
            ))}
          </div>
        )}

        {/* Additional links — preview thumbnails ("the face of the page") for
            video links and any link with an Open Graph image (Zillow, etc.). */}
        <SwiftLinkButtons links={actionLinks} />
      </div>

      {/* Footer — "Made with SwiftCard" badge on Free, removed on Pro/Office */}
      {!ownerPaid ? (
        <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="relative mt-10 flex items-center gap-1.5 text-white/45 text-[11px] hover:text-white/80 transition-colors">
          <svg viewBox="0 0 100 100" className="w-3 h-3"><polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="currentColor" /></svg>
          Made with SwiftCard.me
        </a>
      ) : (
        <a href={`${APP_URL}/card/${username}`} className="relative mt-10 text-white/40 text-[11px] hover:text-white/70 transition-colors">
          View Swift Card
        </a>
      )}
    </main>
  );
}
