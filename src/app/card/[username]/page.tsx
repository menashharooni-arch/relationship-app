import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SaveContactButton from "@/components/SaveContactButton";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import CardEventTracker from "@/components/CardEventTracker";
import ShareButton from "@/components/ShareButton";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import type { CardData } from "@/components/card-templates/types";

const TEMPLATES: Record<string, React.ComponentType<{ data: CardData }>> = {
  "classic-pro": ClassicPro,
  "modern-bold": ModernBold,
  "photo-first": PhotoFirst,
  "local-business": LocalBusiness,
  "luxury-minimal": LuxuryMinimal,
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function normalizeUrl(raw: string, base: string) {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
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

  const { data: extraCard } = !profileData
    ? await supabase.from("cards").select("*, profiles!inner(plan)").eq("username", username).single()
    : { data: null };

  const profile = profileData ?? (extraCard ? { ...extraCard, plan: (extraCard as { profiles?: { plan?: string } }).profiles?.plan ?? "free" } : null);

  if (!profile) notFound();

  const isPro = profile.plan === "pro" || profile.plan === "enterprise";

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

  const customization = (profile.customization ?? {}) as { snapchat?: string; about?: string; accentColor?: string; font?: string; links?: { emoji: string; label: string; url: string }[]; testimonials?: { name: string; text: string }[] };
  const snapchat = customization.snapchat || "";
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
    photoUrl: profile.photo_url || null,
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

  // Build clickable social links
  const socialLinks = [
    snapchat && {
      label: "Snapchat",
      href: snapchat.startsWith("@")
        ? `https://snapchat.com/add/${snapchat.slice(1)}`
        : normalizeUrl(snapchat, "https://snapchat.com/add"),
      color: "#FFFC00",
      textColor: "#000000",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12.065 2C7.965 2 5.044 5.004 5.044 9.251v.307l-.001.111c-.046.97-.5 1.842-1.259 2.39a.43.43 0 00-.125.566c.108.192.33.286.548.24.556-.12 1.099-.308 1.617-.559a.142.142 0 01.147.007c.035.024.058.063.058.104 0 .043-.026.082-.065.103-.695.369-1.118 1.09-1.118 1.87 0 .168.019.335.057.5.198.867.915 1.542 1.838 1.717.282.053.573.08.866.08.303 0 .604-.028.895-.083.163-.031.325.054.393.207.716 1.613 2.26 2.682 4.011 2.862.173.017.345.026.52.026.176 0 .348-.009.521-.026 1.75-.18 3.295-1.249 4.011-2.862.068-.153.23-.238.393-.207.291.055.592.083.895.083.293 0 .584-.027.866-.08.923-.175 1.64-.85 1.838-1.717.038-.165.057-.332.057-.5 0-.78-.423-1.501-1.118-1.87a.117.117 0 01-.065-.103c0-.041.023-.08.058-.104a.143.143 0 01.147-.007c.518.251 1.061.44 1.617.559.218.046.44-.048.548-.24a.43.43 0 00-.125-.566c-.759-.548-1.213-1.42-1.259-2.39l-.001-.111v-.307C18.956 5.004 16.035 2 11.935 2h.13z"/>
        </svg>
      ),
    },
    profile.linkedin && {
      label: "LinkedIn",
      href: normalizeUrl(profile.linkedin, "https://linkedin.com/in"),
      color: "#0A66C2",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    profile.instagram && {
      label: "Instagram",
      href: normalizeUrl(profile.instagram, "https://instagram.com"),
      color: "#E1306C",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
    },
    profile.twitter && {
      label: "X / Twitter",
      href: normalizeUrl(profile.twitter, "https://x.com"),
      color: "#000000",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    profile.tiktok && {
      label: "TikTok",
      href: normalizeUrl(profile.tiktok, "https://tiktok.com/@"),
      color: "#010101",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.95a8.27 8.27 0 004.84 1.56V7.07a4.85 4.85 0 01-1.07-.38z" />
        </svg>
      ),
    },
    profile.website && {
      label: "Website",
      href: normalizeUrl(profile.website, "https://"),
      color: "#1D4ED8",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3 12a8.959 8.959 0 00.284 2.253" />
        </svg>
      ),
    },
  ].filter(Boolean) as { label: string; href: string | null; color: string; textColor?: string; icon: React.ReactNode }[];

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

      {/* Action links (link-in-bio) */}
      {actionLinks.length > 0 && (
        <div className="w-full max-w-sm flex flex-col gap-2">
          {actionLinks.map((link, i) => (
            <a
              key={i}
              href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full py-3.5 px-5 rounded-2xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
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

      {/* Save contact */}
      <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <p className="text-slate-900 font-semibold text-sm">Save {firstName}&apos;s contact</p>
        </div>
        <p className="text-slate-400 text-xs mb-4 ml-9">One tap adds them to your phone contacts — no app needed.</p>
        <SaveContactButton person={person} username={profile.username} source={source} />
      </div>

      {/* Social links */}
      {socialLinks.length > 0 && (
        <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Connect with {firstName}</p>
          <div className="flex flex-col gap-2">
            {socialLinks.map((s) =>
              s.href ? (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm hover:opacity-90 active:scale-[0.98]"
                  style={{ background: s.color + "12", color: s.textColor ?? s.color, border: `1px solid ${s.color}22` }}
                >
                  {s.icon}
                  {s.label}
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 ml-auto opacity-50">
                    <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                  </svg>
                </a>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Share info */}
      <div className="w-full max-w-sm rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <p className="text-slate-900 font-semibold text-sm">Share your info with {firstName}</p>
        </div>
        <p className="text-slate-400 text-xs mb-4 ml-9">They&apos;ll get your details and can follow up directly.</p>
        <LeadCaptureForm cardOwner={profile.username} source={source} />
      </div>

      {/* Share card */}
      <div className="w-full max-w-sm">
        <ShareButton
          url={publicCardUrl}
          title={`${profile.name}'s digital card`}
          text={`Connect with ${firstName} — save their contact instantly.`}
          label="Share this card"
        />
      </div>

      {!isPro && (
        <a
          href={`${APP_URL}/login?mode=signup`}
          className="flex items-center gap-2 rounded-2xl px-5 py-3 transition-opacity hover:opacity-80"
          style={{ background: "#fff", border: "1px solid #E4DDD4" }}
        >
          <div className="w-5 h-5 rounded bg-[#1D4ED8] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-slate-600 text-xs font-semibold">Get your own card — free</p>
            <p className="text-slate-400 text-[10px]">Powered by SwiftCard</p>
          </div>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-300">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </a>
      )}
    </main>
  );
}
