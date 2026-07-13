import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import GrowLinkButton from "@/components/GrowLinkButton";
import MobileNav from "@/components/MobileNav";
import CopyButton from "@/components/CopyButton";
import EmailSignatureBox from "@/components/EmailSignatureBox";
import { cardHeadshot } from "@/lib/card-media";
import { sanitizeCustomizationForPlan } from "@/lib/plan";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// "Share" — the Swift Links link and the Email Signature generator, per card.
// These used to live on the dashboard; grouped here as their own destination
// between Contacts and Settings. Both are card-scoped, so a card switcher shows
// when the user has more than one.
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

      {/* Top accent stripe */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky nav */}
      <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <SwiftCardIcon size={28} />
            <span className="font-bold text-white text-sm tracking-tight hidden sm:block">SwiftCard</span>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {[
              { href: "/dashboard", label: "Dashboard", active: false },
              { href: "/contacts", label: "Contacts", active: false },
              { href: "/share", label: "Share", active: true },
              { href: "/settings/flows", label: "Settings", active: false },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "text-white font-medium bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800/60"}`}>
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GrowLinkButton />
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-white transition-colors">← Dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-md mx-auto pt-20">
        {/* Header */}
        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-[0.25em] text-blue-500 uppercase mb-1">SwiftCard</p>
          <h1 className="text-2xl font-bold text-white">Share</h1>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">Your Swift Links page and email signature — everything you drop into a bio or the bottom of an email.</p>
        </div>

        {/* Card switcher (only with multiple cards) */}
        {allCards.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {allCards.map((c) => {
              const on = c.username === activeUsername;
              return (
                <Link
                  key={c.id}
                  href={`/share?card=${c.username}`}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${on ? "bg-blue-600/15 border-blue-600/50 text-blue-200" : "bg-gray-800/60 border-gray-700/60 text-gray-400 hover:text-white"}`}
                >
                  {(c.label || c.name || c.username) as string}
                </Link>
              );
            })}
          </div>
        )}

        <div className="space-y-6">
          {/* Swift Links */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Swift Links</p>
            <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
              <p className="text-gray-500 text-xs mb-3 leading-relaxed">
                A separate link from your card — your bio, socials, and links in one place. Drop it in your Instagram, TikTok, or any social bio.
              </p>
              <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.8} className="w-3.5 h-3.5 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <span className="text-blue-400 text-xs truncate flex-1">{swiftUrl.replace("https://", "")}</span>
                <CopyButton text={swiftUrl} />
              </div>
              <a href={swiftUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full py-2 transition-colors">
                Open Swift Links →
              </a>
            </div>
          </div>

          {/* Email signature */}
          <div id="signature" className="scroll-mt-24">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Email signature</p>
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
          </div>
        </div>
      </div>
    </main>
  );
}
