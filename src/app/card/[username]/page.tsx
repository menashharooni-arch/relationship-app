import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import SaveContactButton from "@/components/SaveContactButton";
import AddToWalletButton from "@/components/AddToWalletButton";
import { hasWalletConfig } from "@/lib/wallet-config";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import CardEventTracker from "@/components/CardEventTracker";
import SignupNudgeHost from "@/components/SignupNudgeHost";
import ShareButton from "@/components/ShareButton";
import SocialLinkIntercept from "@/components/SocialLinkIntercept";
import CardActionLinks from "@/components/CardActionLinks";
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
import { cardWithinPlanLimit } from "@/lib/card-active";
import CardScaler from "@/components/CardScaler";
import { isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";
import { cardHeadshot } from "@/lib/card-media";
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
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

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
  searchParams: Promise<{ source?: string; embed?: string }>;
}) {
  const { username } = await params;
  const { source: rawSource, embed } = await searchParams;
  const source = rawSource ?? "direct_link";
  const isEmbed = embed === "1"; // rendered inside the /preview demo — skip tracking + nudge

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

  // Plan kill-switch: a Free account only serves its first card(s) — extra
  // cards created on Pro go dark (page, QR, links) after a downgrade.
  if (cardRow && !(await cardWithinPlanLimit(cardRow.id as string, cardRow.user_id as string, cardOwner?.plan))) {
    notFound();
  }

  // Don't count the owner viewing their own card as a view.
  const ownerId = cardRow ? (cardRow.user_id as string) : (profileRow?.id as string | undefined);
  const { data: { user: viewer } } = await (await createClient()).auth.getUser();
  const isOwnerView = !!viewer && viewer.id === ownerId;

  // Per-card headshot (account photo is only a fallback for legacy cards).
  const accountPhotoUrl = cardRow ? (cardOwner?.photo_url ?? null) : (legacyCardOk ? (profileRow?.photo_url ?? null) : null);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

  // Render-time plan enforcement: a downgraded Pro's card may still have Pro
  // design keys (accentColor/font) and >2 link buttons SAVED — the save-time
  // sanitizer only covers new writes. Sanitize here too so the PUBLIC card
  // always reflects the owner's CURRENT plan (Swift Links page already does).
  const customization = sanitizeCustomizationForPlan(
    (profile.customization ?? {}) as Record<string, unknown>,
    isPaidPlan(profile.plan)
  ) as {
    bio?: string;
    facebook?: string;
    snapchat?: string;
    youtube?: string;
    address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string };
    accentColor?: string;
    font?: string;
    links?: { emoji: string; label: string; url: string }[];
    testimonials?: { name: string; text: string }[];
    phones?: { number: string; label: "mobile" | "office"; showOnCard: boolean }[];
    fax?: string;
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
    photoUrl: cardHeadshot(profile.customization, accountPhotoUrl),
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
    phones: (customization.phones ?? []).filter((p) => p?.number?.trim()),
    fax: customization.fax || "",
    website: profile.website || "",
    address: {
      street: addr?.street || "",
      unit: addr?.unit || "",
      city: addr?.city || "",
      state: addr?.state || "",
      zip: addr?.zip || "",
    },
    linkedin: profile.linkedin || "",
    instagram: profile.instagram || "",
    twitter: profile.twitter || "",
    tiktok: profile.tiktok || "",
  };

  // The custom designer is Pro-only — a downgraded card falls back to the
  // standard template at render time (same rule the save path enforces).
  const rawTemplateId = (profile.template as string) || "classic-pro";
  const templateId = rawTemplateId === "custom" && !isPaidPlan(profile.plan) ? "classic-pro" : rawTemplateId;
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

  // Card-only mode (?embed=card): render just the card, used as the /preview inline preview.
  if (embed === "card") {
    return (
      <div id="sc-card-only" className="w-full overflow-hidden" style={{ background: "#FAF7F2" }}>
        <CardScaler>
          <TemplateComponent data={templateId === "custom" ? cardData : withoutSocials(cardData)} />
        </CardScaler>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-10 pb-16 gap-5" style={{ background: "#FAF7F2" }}>
      {!isEmbed && !isOwnerView && <CardEventTracker username={profile.username} source={source} />}
      {!isEmbed && <SignupNudgeHost />}

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
          suppressTracking={isOwnerView}
        />
        {hasWalletConfig() && (
          <div className="mt-2">
            <AddToWalletButton username={profile.username} />
          </div>
        )}
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
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <SectionNumber n={3} />
              <p className="text-slate-900 font-semibold text-sm">Swift Links</p>
            </div>
            {/* Small, light jump to this card's full Swift Links page */}
            <a
              href={`/links/${profile.username}`}
              className="shrink-0 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors px-1 py-1"
            >
              Go to Swift Links →
            </a>
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
          <CardActionLinks links={actionLinks} spaced={connectLinks.length > 0} />
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

      {/* "Powered by SwiftCard.me" badge (links to site) — Free only, removed on Pro/Office */}
      {!isPaidPlan(profile.plan) && (
        <a
          href={`${APP_URL}/?src=badge`}
          className="w-full max-w-sm flex items-center justify-center gap-1.5 text-slate-400 text-[11px] hover:text-slate-600 transition-colors py-1"
        >
          <svg viewBox="0 0 100 100" className="w-3 h-3"><polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="currentColor" /></svg>
          Powered by SwiftCard.me
        </a>
      )}
    </main>
  );
}
