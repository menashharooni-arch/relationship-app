import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { buildConnectLinks } from "@/lib/social-url";
import SocialLinkIntercept from "@/components/SocialLinkIntercept";
import ConnectButton from "@/components/ConnectButton";
import CardEventTracker from "@/components/CardEventTracker";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

async function resolve(username: string) {
  const admin = getAdminSupabase();
  const { data: cardRow } = await admin.from("cards").select("*").eq("username", username).maybeSingle();
  const { data: cardOwner } = cardRow
    ? await admin.from("profiles").select("photo_url").eq("id", cardRow.user_id).maybeSingle()
    : { data: null };
  const { data: profileRow } = !cardRow
    ? await admin.from("profiles").select("*").eq("username", username).maybeSingle()
    : { data: null };
  const legacyOk = !!profileRow && !((profileRow.customization as { _migrated?: boolean } | null)?._migrated) && !!profileRow.name;
  const profile = cardRow ?? (legacyOk ? profileRow : null);
  const photoUrl = cardRow ? (cardOwner?.photo_url ?? null) : (legacyOk ? (profileRow?.photo_url ?? null) : null);
  return { profile, photoUrl };
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
  const { profile, photoUrl } = await resolve(username);
  if (!profile) notFound();

  const customization = (profile.customization ?? {}) as {
    bio?: string;
    facebook?: string;
    snapchat?: string;
    youtube?: string;
    links?: { emoji: string; label: string; url: string }[];
  };
  const bio = customization.bio || "";
  const actionLinks = (customization.links ?? []).filter((l) => l.label && l.url);

  const connectLinks = buildConnectLinks({
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
  const subtitle = [profile.title, profile.company].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-12 pb-16 gap-4" style={{ background: "#FAF7F2" }}>
      <CardEventTracker username={username} source="swift_links" />

      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2 max-w-sm w-full">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={profile.name || ""} className="w-20 h-20 rounded-full object-cover shadow-sm" />
        ) : (
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ background: "#1D4ED8" }}>
            {profile.name ? initials(profile.name) : "SC"}
          </div>
        )}
        <h1 className="text-xl font-bold text-slate-900 mt-1">{profile.name || username}</h1>
        {subtitle && <p className="text-slate-500 text-sm">{subtitle}</p>}
      </div>

      {/* Bio + Connect */}
      <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
        {bio && <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap mb-4">{bio}</p>}
        <ConnectButton cardOwner={username} ownerFirstName={firstName} />
      </div>

      {/* Social links */}
      {connectLinks.length > 0 && (
        <div className="w-full max-w-sm">
          <SocialLinkIntercept links={connectLinks} cardOwner={username} ownerFirstName={firstName} />
        </div>
      )}

      {/* Additional links */}
      {actionLinks.length > 0 && (
        <div className="w-full max-w-sm flex flex-col gap-2">
          {actionLinks.map((link, i) => (
            <a
              key={i}
              href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 w-full py-3.5 px-5 rounded-2xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
              style={{ background: "#fff", border: "1px solid #E4DDD4", color: "#0f172a" }}
            >
              <span className="text-base">{link.emoji}</span>
              {link.label}
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 ml-auto opacity-30">
                <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
              </svg>
            </a>
          ))}
        </div>
      )}

      <a href={`${APP_URL}/card/${username}`} className="text-slate-400 text-xs mt-2 hover:text-slate-600 transition-colors">
        View {firstName}&apos;s full card →
      </a>
    </main>
  );
}
