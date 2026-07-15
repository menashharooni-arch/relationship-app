import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import DashboardLink from "@/components/DashboardLink";
import GrowLinkButton from "@/components/GrowLinkButton";
import MobileNav from "@/components/MobileNav";
import HelpWidget from "@/components/HelpWidget";
import CopyButton from "@/components/CopyButton";
import EmailSignatureBox from "@/components/EmailSignatureBox";
import ShareCardResolver from "@/components/ShareCardResolver";
import SwiftLinksQR from "@/components/SwiftLinksQR";
import { cardHeadshot } from "@/lib/card-media";
import { sanitizeCustomizationForPlan } from "@/lib/plan";
import { canViewOfficeAdmin } from "@/lib/office-roles";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// "Share" — the Swift Links link and the Email Signature generator for the
// CURRENTLY SELECTED card only. The card comes from ?card= (carried by the
// dashboard nav); ShareCardResolver backfills it from the card the user last
// selected on the dashboard when the URL doesn't name one, so this page always
// mirrors the card they're working on rather than showing a picker.
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string }>;
}) {
  const params = await searchParams;
  const selectedCard = params.card ?? null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");
  if ((profile.customization as { _deleted?: boolean } | null)?._deleted) redirect("/account-deleted");

  const { data: cards } = await getAdminSupabase()
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const allCards = cards ?? [];
  // Need a card to have a Swift Links URL / signature — send card-less users to
  // the dashboard to create one first.
  if (allCards.length === 0) redirect("/dashboard");

  const activeCard = allCards.find((c) => c.username === selectedCard) ?? allCards[0];
  const activeSource = activeCard;
  const activeUsername = activeCard.username as string;
  const isPro = profile.plan === "pro" || profile.plan === "enterprise";
  // Keep the "Admin" nav item present across the app shell (same gate as the page).
  const showOfficeAdmin = await canViewOfficeAdmin(user.id, profile.plan);

  const cardUrl = `${APP_URL}/card/${activeUsername}`;
  const swiftUrl = `${APP_URL}/links/${activeUsername}`;

  function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  const _addr = (activeSource.customization as { address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string } } | null)?.address;
  const activeAddress = _addr
    ? [
        [_addr.street, _addr.unit ? `Unit ${_addr.unit}` : ""].filter(Boolean).join(", "),
        _addr.city ?? "",
        [_addr.state, _addr.zip].filter(Boolean).join(" "),
      ].filter(Boolean).join("\n")
    : "";

  const cardData = {
    name: activeSource.name || "",
    title: activeSource.title || "",
    company: activeSource.company || "",
    phone: activeSource.phone || "",
    email: activeSource.email || "",
    website: activeSource.website || "",
    instagram: activeSource.instagram || "",
    twitter: activeSource.twitter || "",
    tiktok: activeSource.tiktok || "",
    linkedin: activeSource.linkedin || "",
    initials: activeSource.name ? initials(activeSource.name) : "SC",
    photoUrl: cardHeadshot(activeSource.customization, profile.photo_url),
    logoUrl: activeSource.logo_url || null,
    cardUrl: `${APP_URL.replace("https://", "")}/card/${activeUsername}`,
    address: activeAddress,
    customization: sanitizeCustomizationForPlan((activeSource.customization ?? {}) as Record<string, unknown>, isPro),
  };
  const activeTemplate = (activeSource.template ?? "classic-pro") === "custom" && !isPro
    ? "classic-pro"
    : (activeSource.template ?? "classic-pro");

  return (
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-10 pb-24 md:pb-10">
      <MobileNav />
      <HelpWidget floating />

      {/* Top accent stripe */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky nav */}
      <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <DashboardLink className="flex items-center gap-2 shrink-0">
            <SwiftCardIcon size={28} />
            <span className="font-bold text-white text-sm tracking-tight hidden sm:block">SwiftCard</span>
          </DashboardLink>

          <div className="hidden md:flex items-center gap-0.5">
            <DashboardLink className="text-sm px-3 py-1.5 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-gray-800/60">
              Dashboard
            </DashboardLink>
            {[
              { href: "/contacts", label: "Contacts", active: false },
              { href: "/share", label: "Links", active: true },
              { href: "/settings/flows", label: "Settings", active: false },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "text-white font-medium bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800/60"}`}>
                {label}
              </Link>
            ))}
            {showOfficeAdmin && (
              <Link href="/office/admin" className="text-sm text-purple-400 hover:text-purple-300 hover:bg-gray-800/60 px-3 py-1.5 rounded-lg transition-colors font-medium">
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GrowLinkButton />
            <DashboardLink className="text-sm text-gray-500 hover:text-white transition-colors">← Dashboard</DashboardLink>
          </div>
        </div>
      </nav>

      {/* Ensure the page reflects the currently selected card when the URL
          didn't carry one. */}
      <ShareCardResolver current={activeUsername} />

      {(() => {
        const cardLabel = (activeCard.label || activeCard.name || activeUsername) as string;
        return (
      <div className="max-w-md lg:max-w-5xl mx-auto pt-20">
        {/* Masthead — frames the two channels and names the card they belong to,
            so it's unambiguous which card's Swift Links / signature are shown. */}
        <header className="mb-8 sc-rise">
          <p className="text-[11px] font-bold tracking-[0.28em] text-blue-500 uppercase mb-2">SwiftCard · Share</p>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white">Links</h1>
          <p className="text-gray-400 text-sm lg:text-base mt-2.5 leading-relaxed max-w-xl">
            Two ways your card travels — a scannable link for your bios and DMs, and a signature that rides along with every email you send.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 border border-gray-800/80 pl-1.5 pr-3.5 py-1.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-[10px] font-bold" style={{ background: "var(--rd-aurora)" }}>{initials(cardLabel)}</span>
            <span className="text-xs text-gray-400">For <span className="text-gray-200 font-medium">{cardLabel}</span> <span className="text-gray-600">· /{activeUsername}</span></span>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
          {/* Swift Links — anchored by a real, scannable QR code */}
          <section data-tour="swift-links" className="sc-rise sc-rise-2 h-full">
            <div className="h-full flex flex-col bg-gray-900 border border-gray-800/80 rounded-2xl p-5 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Scan or tap</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live
                </span>
              </div>

              {/* Visual anchor: a real QR code for this card's Swift Links */}
              <div className="rounded-2xl p-5 flex flex-col items-center gap-3" style={{ background: "var(--rd-aurora)" }}>
                <div className="bg-white rounded-2xl p-3 shadow-lg shadow-blue-950/40">
                  <SwiftLinksQR url={swiftUrl} />
                </div>
                <p className="text-white/90 text-[11px] font-semibold tracking-wide text-center">Scan to open — or tap the link below</p>
              </div>

              <h2 className="text-lg font-bold text-white mt-5">Swift Links</h2>
              <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
                A separate link from your card — your bio, socials, and links in one place. Drop it in your Instagram, TikTok, or any social bio.
              </p>

              <div className="mt-5 lg:mt-auto space-y-3 lg:pt-5">
                <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.8} className="w-3.5 h-3.5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  <span className="font-mono text-blue-400 text-xs truncate flex-1">{swiftUrl.replace("https://", "")}</span>
                  <CopyButton text={swiftUrl} />
                </div>
                <a href={swiftUrl} target="_blank" rel="noopener noreferrer" className="sc-btn-glow block text-center text-sm font-semibold text-white rounded-full py-2.5 transition-transform hover:-translate-y-0.5" style={{ background: "var(--rd-aurora)" }}>
                  Open Swift Links →
                </a>
              </div>
            </div>
          </section>

          {/* Swift Signature (email signature) */}
          <section id="signature" data-tour="email-signature" className="sc-rise sc-rise-3 h-full scroll-mt-24">
            <EmailSignatureBox
              key={activeUsername}
              cardData={cardData}
              template={activeTemplate}
              name={activeSource.name ?? ""}
              company={activeSource.company ?? ""}
              cardUrl={cardUrl}
              username={activeUsername}
              storageUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/card-signatures/${activeUsername}.png`}
              ogUrl={`${APP_URL}/card/${activeUsername}/opengraph-image`}
            />
          </section>
        </div>
      </div>
        );
      })()}
    </main>
  );
}
