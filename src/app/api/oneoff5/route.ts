import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { videoThumbnail } from "@/lib/video";

// TEMPORARY diagnostic: list a card's extra links + whether each gets a video thumb.
const TOKEN = "sc-oneoff-8w2r5n7k";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "nope" }, { status: 404 });
  }
  const username = req.nextUrl.searchParams.get("u") || "menash";
  const admin = getAdminSupabase();
  const { data: card } = await admin.from("cards").select("customization").eq("username", username).maybeSingle();
  const links = ((card?.customization as { links?: { emoji: string; label: string; url: string }[] } | null)?.links) ?? [];
  return NextResponse.json({
    username,
    links: links.map((l) => ({ label: l.label, url: l.url, videoThumb: videoThumbnail(l.url) })),
  });
}
