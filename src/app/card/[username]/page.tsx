import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import SaveContactButton from "@/components/SaveContactButton";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import CardEventTracker from "@/components/CardEventTracker";
import ShareButton from "@/components/ShareButton";
import SocialLinkIntercept from "@/components/SocialLinkIntercept";
import QRCodeModal from "@/components/QRCodeModal";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import CustomCard from "@/components/card-templates/CustomCard";
import type { CardData } from "@/components/card-templates/types";

const TEMPLATES: Record<string, React.ComponentType<{ data: CardData }>> = {
  "classic-pro": ClassicPro,
  "modern-bold": ModernBold,
  "photo-first": PhotoFirst,
  "local-business": LocalBusiness,
  "luxury-minimal": LuxuryMinimal,
  "custom": CustomCard,
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// Build a valid profile URL from whatever was stored: a full URL, a platform URL
// (e.g. "instagram.com/x"), an "@handle", or a bare handle.
function socialUrl(platform: string, raw?: string | null): string | null {
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
    snapchat: "snapchat.com",
    youtube: "youtube.com",
  };
  // Already references the platform's own domain → just make it absolute.
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
    case "snapchat":  return `https://snapchat.com/add/${handle}`;
    case "youtube":   return `https://youtube.com/@${handle}`;
    case "website":   return /\.[a-z]{2,}/i.test(handle) ? `https://${handle.replace(/^\/+/, "")}` : null;
    default:          return `https://${handle}`;
  }
}

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: "#1D4ED8" }}>
      {n}
    </span>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const admin = getAdminSupabase();
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

  const { data: profile } = await admin
    .from("profiles")
    .select("name, title, company, photo_url")
    .eq("username", username)
    .single();

  const { data: card } = !profile
    ? await admin.from("cards").select("name, title, company").eq("username", username).single()
    : { data: null };

  const p = profile ?? card;
  if (!p) return { title: "SwiftCard" };

  const name = p.name ?? username;
  const parts = [p.title, p.company].filter(Boolean).join(" at ");
  const description = parts
    ? `Connect with ${name} — ${parts}. Save their contact instantly.`
    : `Connect with ${name} on SwiftCard. Save their contact instantly.`;

  return {
    title: `${name}${parts ? ` — ${parts}` : ""}`,
    description,
    openGraph: {
      title: name,
      description,
      url: `${APP_URL}/card/${username}`,
      siteName: "SwiftCard",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
    },
  };
}

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { username } = await params;
  const { source: rawSource } = await searchParams;
  const source = rawSource ?? "direct_link";
  const supabase = await createClient();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  // Resolve extra cards with the admin client so row-level security doesn't hide
  // newly added cards. Fetch the owner profile separately rather than via a
  // PostgREST embedded join (which needs a direct cards->profiles FK that may not exist).
  const admin = getAdminSupabase();
  const { data: extraCard } = !profileData
    ? await admin.from("cards").select("*").eq("username", username).single()
    : { data: null };

  const { data: ownerProfile } = extraCard
    ? await admin.from("profiles").select("plan, photo_url").eq("id", extraCard.user_id).single()
    : { data: null };

  const profile = profileData ?? (extraCard ? { ...extraCard, plan: ownerProfile?.plan ?? "free" } : null);

  if (!profile) notFound();

  // One profile picture is shared across all of an account's cards.
  const accountPhotoUrl = profileData ? (profileData.photo_url ?? null) : (ownerProfile?.photo_url ?? null);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

  const customization = (profile.customization ?? {}) as {
    snapchat?: string;
    youtube?: string;
    about?: string;
    accentColor?: string;
    font?: string;
    links?: { emoji: string; label: string; url: string }[];
    testimonials?: { name: string; text: string }[];
  };
  const snapchat = customization.snapchat || "";
  const youtube = customization.youtube || "";
  const about = customization.about || "";
  const actionLinks = (customization.links ?? []).filter((l) => l.label && l.url);
  const testimonials = (customization.testimonials ?? []).filter((t) => t.name && t.text);

  const cardData: CardData = {
    name: profile.name || "",
    title: profile.title || "",
    company: profile.company || "",
    phone: profile.phone || "",
    email: profile.email || "",
    website: profile.website || "",
    instagram: profile.instagram || "",
    twitter: profile.twitter || "",
    tiktok: profile.tiktok || "",
    linkedin: profile.linkedin || "",
    snapchat,
    about,
    initials: profile.name ? initials(profile.name) : "SC",
    photoUrl: accountPhotoUrl,
    logoUrl: profile.logo_url || null,
    cardUrl: `${APP_URL.replace("https://", "")}/card/${profile.username}`,
    customization: profile.customization ?? {},
  };

  const person = {
    name: profile.name,
    title: profile.title || "",
    company: profile.company || "",
    email: profile.email || "",
    phone: profile.phone || "",
    website: profile.website || "",
    linkedin: profile.linkedin || "",
    instagram: profile.instagram || "",
    twitter: profile.twitter || "",
    tiktok: profile.tiktok || "",
  };

  const templateId = (profile.template as string) || "classic-pro";
  const TemplateComponent = TEMPLATES[templateId] ?? ClassicPro;
  const publicCardUrl = `${APP_URL}/card/${profile.username}`;
  const firstName = profile.name?.split(" ")[0] ?? "them";

  // Show a short, readable handle under each social button.
  const handleLabel = (raw?: string | null) => (raw || "").trim().replace(/^https?:\/\//i, "");

  // Build serializable social link data (no ReactNode icons — SocialLinkIntercept renders icons by label)
  const connectLinks = [
    { label: "LinkedIn",    href: socialUrl("linkedin", profile.linkedin),   sub: handleLabel(profile.linkedin),  color: "#0A66C2" },
    { label: "Instagram",   href: socialUrl("instagram", profile.instagram), sub: handleLabel(profile.instagram), color: "#E1306C" },
    { label: "X / Twitter", href: socialUrl("twitter", profile.twitter),     sub: handleLabel(profile.twitter),   color: "#000000" },
    { label: "Snapchat",    href: socialUrl("snapchat", snapchat),           sub: handleLabel(snapchat),          color: "#FFCA28", textColor: "#1a1a00" },
    { label: "TikTok",      href: socialUrl("tiktok", profile.tiktok),       sub: handleLabel(profile.tiktok),    color: "#010101" },
    { label: "YouTube",     href: socialUrl("youtube", youtube),             sub: handleLabel(youtube),           color: "#FF0000" },
    { label: "Website",     href: socialUrl("website", profile.website),     sub: handleLabel(profile.website),   color: "#1D4ED8" },
  ].filter((l) => l.href) as { label: string; href: string; sub?: string; color: string; textColor?: string }[];

  // Total connect items = social links + action links
  const hasConnectSection = connectLinks.length > 0 || actionLinks.length > 0;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-10 pb-16 gap-5" style={{ background: "#FAF7F2" }}>
      <CardEventTracker username={profile.username} source={source} />

      {/* Business card */}
      <div className="w-full max-w-sm">
        <TemplateComponent data={cardData} />
      </div>

      {/* About section */}
      {about && (
        <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">About</p>
          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{about}</p>
        </div>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4">What people say</p>
          <div className="flex flex-col gap-3">
            {testimonials.map((t, i) => (
              <div key={i} className="rounded-xl px-4 py-3" style={{ background: "#FAF7F2" }}>
                <p className="text-yellow-500 text-xs mb-1.5">★★★★★</p>
                <p className="text-slate-700 text-sm leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <p className="text-slate-400 text-xs mt-2 font-medium">— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 1: Save Contact ── */}
      <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
        <div className="flex items-center gap-3 mb-1">
          <SectionNumber n={1} />
          <p className="text-slate-900 font-semibold text-sm">Save {firstName}&apos;s contact</p>
        </div>
        <p className="text-slate-400 text-xs mb-4 ml-9">One tap adds them to your phone contacts — no app needed.</p>
        <SaveContactButton
          person={person}
          username={profile.username}
          source={source}
          cardOwner={profile.username}
          ownerFirstName={firstName}
        />
      </div>

      {/* ── Section 2: Share Your Info Back ── */}
      <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
        <div className="flex items-center gap-3 mb-1">
          <SectionNumber n={2} />
          <p className="text-slate-900 font-semibold text-sm">Share your info with {firstName}</p>
        </div>
        <p className="text-slate-400 text-xs mb-4 ml-9">They&apos;ll get your details and can follow up directly.</p>
        <LeadCaptureForm cardOwner={profile.username} source={source} />
      </div>

      {/* ── Section 3: Other Ways to Connect ── */}
      {hasConnectSection && (
        <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
          <div className="flex items-center gap-3 mb-4">
            <SectionNumber n={3} />
            <p className="text-slate-900 font-semibold text-sm">Other ways to connect with {firstName}</p>
          </div>
          {/* Social links with intercept modal */}
          {connectLinks.length > 0 && (
            <SocialLinkIntercept
              links={connectLinks}
              cardOwner={profile.username}
              ownerFirstName={firstName}
            />
          )}
          {/* Custom action links (link-in-bio style) */}
          {actionLinks.length > 0 && (
            <div className={`flex flex-col gap-2${connectLinks.length > 0 ? " mt-2" : ""}`}>
              {actionLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 w-full py-3.5 px-5 rounded-2xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                  style={{ background: "#FAF7F2", border: "1px solid #E4DDD4", color: "#0f172a" }}
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
        </div>
      )}

      {/* ── Section 4: Share This Card ── */}
      <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
        <div className="flex items-center gap-3 mb-4">
          <SectionNumber n={hasConnectSection ? 4 : 3} />
          <p className="text-slate-900 font-semibold text-sm">Share this card</p>
        </div>
        <ShareButton
          url={publicCardUrl}
          title={`${profile.name}'s digital card`}
          text={`Connect with ${firstName} — save their contact instantly.`}
          label="Share this card"
        />
        <QRCodeModal url={publicCardUrl} firstName={firstName} />
      </div>
    </main>
  );
}
