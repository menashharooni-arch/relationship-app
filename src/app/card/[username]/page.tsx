import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";
import { resolveCardMeta } from "@/lib/resolve-card";
import CardScaler from "@/components/CardScaler";
import { buildConnectLinks } from "@/lib/social-url";

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
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

  const p = await resolveCardMeta(username);
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

  // Cards table is the source of truth. Fall back to a legacy profile-card for any
  // account not yet migrated. Admin client so row-level security doesn't hide cards.
  const admin = getAdminSupabase();
  const { data: cardRow } = await admin.from("cards").select("*").eq("username", username).maybeSingle();
  const { data: cardOwner } = cardRow
    ? await admin.from("profiles").select("plan, photo_url, customization").eq("id", cardRow.user_id).maybeSingle()
    : { data: null };

  const { data: profileRow } = !cardRow
    ? await admin.from("profiles").select("*").eq("username", username).maybeSingle()
    : { data: null };

  // Only treat a profile as a card if it's a legacy, not-yet-migrated card (so a
  // deleted/migrated card doesn't keep resolving from the account profile).
  const legacyCardOk =
    !!profileRow &&
    !((profileRow.customization as { _migrated?: boolean } | null)?._migrated) &&
    !!profileRow.name;

  // Hide cards whose owner account has been deleted.
  const ownerDeleted = cardRow
    ? !!((cardOwner?.customization as { _deleted?: boolean } | null)?._deleted)
    : !!((profileRow?.customization as { _deleted?: boolean } | null)?._deleted);

  const profile = cardRow
    ? { ...cardRow, plan: cardOwner?.plan ?? "free" }
    : (legacyCardOk ? profileRow : null);

  if (!profile || ownerDeleted) notFound();

  // One profile picture is shared across all of an account's cards.
  const accountPhotoUrl = cardRow ? (cardOwner?.photo_url ?? null) : (legacyCardOk ? (profileRow?.photo_url ?? null) : null);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

  const customization = (profile.customization ?? {}) as {
    bio?: string;
    facebook?: string;
    snapchat?: string;
    youtube?: string;
    address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string };
    accentColor?: string;
    font?: string;
    links?: { emoji: string; label: string; url: string }[];
    testimonials?: { name: string; text: string }[];
  };
  const bio = customization.bio || "";
  const facebook = customization.facebook || "";
  const snapchat = customization.snapchat || "";
  const youtube = customization.youtube || "";
  const actionLinks = (customization.links ?? []).filter((l) => l.label && l.url);
  const testimonials = (customization.testimonials ?? []).filter((t) => t.name && t.text);

  const addr = customization.address;
  const addressLine1 = [addr?.street, addr?.unit ? `Unit ${addr.unit}` : ""].filter(Boolean).join(", ");
  const addressLine2 = addr?.city ?? "";
  const addressLine3 = [addr?.state, addr?.zip].filter(Boolean).join(" ");

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
    initials: profile.name ? initials(profile.name) : "SC",
    photoUrl: accountPhotoUrl,
    logoUrl: profile.logo_url || null,
    cardUrl: `${APP_URL.replace("https://", "")}/card/${profile.username}`,
    address: [addressLine1, addressLine2, addressLine3].filter(Boolean).join("\n"),
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

  // Swift Links — socials in canonical order (Website first)
  const connectLinks = buildConnectLinks({
    website: profile.website,
    linkedin: profile.linkedin,
    instagram: profile.instagram,
    tiktok: profile.tiktok,
    facebook,
    twitter: profile.twitter,
    snapchat,
    youtube,
  });

  // Swift Links shows a bio, social links, and additional links
  const hasConnectSection = !!bio || connectLinks.length > 0 || actionLinks.length > 0;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-10 pb-16 gap-5" style={{ background: "#FAF7F2" }}>
      <CardEventTracker username={profile.username} source={source} />

      {/* Business card — socials live in Swift Links, not on the card */}
      <div className="w-full max-w-sm">
        <CardScaler>
          <TemplateComponent data={templateId === "custom" ? cardData : withoutSocials(cardData)} />
        </CardScaler>
      </div>

      {/* Address now lives inside the card design above (no separate section). */}

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
          <div className="flex items-center gap-3 mb-3">
            <SectionNumber n={3} />
            <p className="text-slate-900 font-semibold text-sm">Swift Links</p>
          </div>
          {bio && (
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-4 ml-9">{bio}</p>
          )}
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
