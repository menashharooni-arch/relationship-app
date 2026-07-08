import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import CardEditForm from "./CardEditForm";
import ShareCardCapture from "@/components/ShareCardCapture";
import { cardHeadshot } from "@/lib/card-media";
import type { CardData } from "@/components/card-templates/types";
import Link from "next/link";

export default async function CardEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdminSupabase();
  const [{ data: card }, { data: profile }] = await Promise.all([
    admin.from("cards").select("*").eq("id", id).eq("user_id", user.id).single(),
    admin.from("profiles").select("photo_url, plan").eq("id", user.id).single(),
  ]);


  if (!card) notFound();

  const isPro = profile?.plan === "pro" || profile?.plan === "enterprise";
  // Per-card headshot (legacy cards fall back to the account photo).
  const cardPhoto = cardHeadshot(card.customization, profile?.photo_url);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

  // Share-preview capture data — IDENTICAL construction to the dashboard's, so
  // saving an edit re-photographs the card right here (router.refresh() reloads
  // this server component with fresh data → content hash changes → re-capture).
  // Without this, an edited card's texted-link preview stayed stale until the
  // owner next opened the dashboard with this card selected.
  const _addr = (card.customization as { address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string } } | null)?.address;
  const captureData: CardData = {
    name: card.name || "",
    title: card.title || "",
    company: card.company || "",
    phone: card.phone || "",
    email: card.email || "",
    website: card.website || "",
    instagram: card.instagram || "",
    twitter: card.twitter || "",
    tiktok: card.tiktok || "",
    linkedin: card.linkedin || "",
    initials: card.name ? (card.name as string).split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "SC",
    photoUrl: cardPhoto,
    logoUrl: card.logo_url || null,
    cardUrl: `${APP_URL.replace("https://", "")}/card/${card.username}`,
    address: _addr
      ? [
          [_addr.street, _addr.unit ? `Unit ${_addr.unit}` : ""].filter(Boolean).join(", "),
          _addr.city ?? "",
          [_addr.state, _addr.zip].filter(Boolean).join(" "),
        ].filter(Boolean).join("\n")
      : "",
    customization: card.customization ?? {},
  };

  return (
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </Link>
          <a
            href={`${APP_URL}/card/${card.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View live →
          </a>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-1">SwiftCard</p>
          <h1 className="text-2xl font-bold text-white">Edit card</h1>
          <p className="text-gray-500 text-sm mt-1">/{card.username}</p>
        </div>

        <CardEditForm card={card} photoUrl={cardPhoto} logoUrl={card.logo_url ?? null} isPro={isPro} />
      </div>

      {/* Invisible: keeps the texted-link share preview a pixel-perfect copy
          of this card, re-capturing whenever its content changes. */}
      <ShareCardCapture
        cardData={captureData}
        template={(card.template as string) ?? "classic-pro"}
        username={card.username as string}
      />
    </main>
  );
}
