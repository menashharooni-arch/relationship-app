import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { socialUrl } from "@/lib/social-url";

// TEMPORARY diagnostic: inspect a card's stored socials + the URL they generate.
const TOKEN = "sc-oneoff-5h8d2k4q";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "nope" }, { status: 404 });
  }
  const username = req.nextUrl.searchParams.get("u") || "menash";
  const admin = getAdminSupabase();
  const { data: card } = await admin.from("cards").select("*").eq("username", username).maybeSingle();
  if (!card) return NextResponse.json({ error: "no card" });
  const cust = (card.customization ?? {}) as Record<string, unknown>;
  const raw = {
    website: card.website ?? null,
    linkedin: card.linkedin ?? null,
    instagram: card.instagram ?? null,
    twitter: card.twitter ?? null,
    tiktok: card.tiktok ?? null,
    facebook: cust.facebook ?? null,
    snapchat: cust.snapchat ?? null,
    youtube: cust.youtube ?? null,
  };
  const generated = {
    website: socialUrl("website", raw.website as string),
    linkedin: socialUrl("linkedin", raw.linkedin as string),
    instagram: socialUrl("instagram", raw.instagram as string),
    twitter: socialUrl("twitter", raw.twitter as string),
    tiktok: socialUrl("tiktok", raw.tiktok as string),
    facebook: socialUrl("facebook", raw.facebook as string),
    snapchat: socialUrl("snapchat", raw.snapchat as string),
    youtube: socialUrl("youtube", raw.youtube as string),
  };
  return NextResponse.json({ username, raw, generated });
}
