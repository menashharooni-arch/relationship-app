import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SaveContactButton from "@/components/SaveContactButton";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import ViewTracker from "@/components/ViewTracker";
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

export default async function CardPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  // Check profiles first, then extra cards table
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

  const isPro = profile.plan === "pro";

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
    initials: profile.name ? initials(profile.name) : "K",
    photoUrl: profile.photo_url || null,
    logoUrl: profile.logo_url || null,
    cardUrl: `relationship-app-alpha.vercel.app/card/${profile.username}`,
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

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";
  // NFC-ready URL: this exact path is what gets programmed into NFC chips
  const publicCardUrl = `${APP_URL}/card/${profile.username}`;

  const firstName = profile.name?.split(" ")[0] ?? "them";

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col items-center px-5 py-10 gap-5">
      <ViewTracker username={profile.username} />

      {/* Business card template */}
      <div className="w-full max-w-sm">
        <TemplateComponent data={cardData} />
      </div>

      {/* Step 1: Save contact */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          <p className="text-slate-900 font-semibold text-sm">Save {firstName}&apos;s contact</p>
        </div>
        <p className="text-slate-500 text-xs mb-4 ml-8">Downloads a .vcf file — tap to add directly to your phone contacts.</p>
        <SaveContactButton person={person} username={profile.username} />
      </div>

      {/* Step 2: Share your info */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <p className="text-slate-900 font-semibold text-sm">Share your info with {firstName}</p>
        </div>
        <p className="text-slate-500 text-xs mb-4 ml-8">They&apos;ll receive your details and can follow up with you.</p>
        <LeadCaptureForm cardOwner={profile.username} />
      </div>

      {/* Secondary actions */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        {profile.linkedin && (
          <a
            href={`https://${profile.linkedin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 font-medium py-3 px-6 rounded-full transition-colors text-sm text-center bg-white"
          >
            Connect on LinkedIn
          </a>
        )}
        <ShareButton
          url={publicCardUrl}
          title={`${profile.name}'s digital card`}
          text={`Connect with ${firstName} — save their contact instantly.`}
          label="Share this card"
        />
      </div>

      {!isPro && (
        <p className="text-slate-400 text-xs pb-4">Powered by Kontact</p>
      )}
    </main>
  );
}
