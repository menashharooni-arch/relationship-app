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

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col items-center px-5 py-10 gap-6">
      <ViewTracker username={profile.username} />

      {/* Business card template */}
      <div className="w-full max-w-sm">
        <TemplateComponent data={cardData} />
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <ShareButton
          url={publicCardUrl}
          title={`${profile.name}'s digital card`}
          text={`Connect with ${profile.name?.split(" ")[0] ?? "me"} — save their contact instantly.`}
          label="Share this card"
        />
        <SaveContactButton person={person} />
        {profile.linkedin && (
          <a
            href={`https://${profile.linkedin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 font-semibold py-3 px-6 rounded-full transition-colors text-sm text-center bg-white"
          >
            Connect on LinkedIn
          </a>
        )}
      </div>

      {/* Lead capture */}
      <div className="w-full max-w-sm flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-gray-300" />
        <span className="text-gray-400 text-xs">or share your info</span>
        <div className="flex-1 h-px bg-gray-300" />
      </div>
      <div className="w-full max-w-sm">
        <LeadCaptureForm cardOwner={profile.username} />
      </div>

      {!isPro && (
        <p className="text-gray-400 text-xs pb-4">Powered by Kontact</p>
      )}
    </main>
  );
}
