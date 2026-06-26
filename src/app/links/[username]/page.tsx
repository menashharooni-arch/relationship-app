import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { buildConnectLinks } from "@/lib/social-url";
import { videoThumbnail } from "@/lib/video";
import PlatformIcon from "@/components/PlatformIcon";
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
    ? await admin.from("profiles").select("photo_url, customization").eq("id", cardRow.user_id).maybeSingle()
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
      className="h-[100dvh] w-full overflow-hidden relative flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #0B1020 0%, #181538 55%, #2A2466 100%)" }}
    >
      <CardEventTracker username={username} source="swift_links" />

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
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white border border-white/15 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur"
              >
                <PlatformIcon label={s.label} className="w-[18px] h-[18px]" />
              </a>
            ))}
          </div>
        )}

        {/* Additional links */}
        {actionLinks.length > 0 && (
          <div className="w-full flex flex-col gap-2 mt-5">
            {actionLinks.slice(0, 5).map((link, i) => {
              const href = link.url.startsWith("http") ? link.url : `https://${link.url}`;
              const thumb = videoThumbnail(link.url);
              if (thumb) {
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full p-2 pr-4 rounded-2xl text-sm text-white border border-white/15 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur flex items-center gap-3"
                  >
                    <div className="relative w-20 h-12 rounded-xl overflow-hidden shrink-0 bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb} alt={link.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full bg-black/55 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="#fff" className="w-3.5 h-3.5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold truncate flex-1 text-left">{link.label}</span>
                  </a>
                );
              }
              return (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-5 rounded-2xl font-semibold text-sm text-white border border-white/15 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur flex items-center justify-between"
                >
                  <span className="truncate">{link.label}</span>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 opacity-50 shrink-0 ml-2">
                    <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                  </svg>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <a href={`${APP_URL}/card/${username}`} className="absolute bottom-5 text-white/40 text-[11px] hover:text-white/70 transition-colors">
        View full card · swiftcard.me
      </a>
    </main>
  );
}
