import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;

  const city = req.headers.get("x-vercel-ip-city");
  const country = req.headers.get("x-vercel-ip-country");
  const location = city && country
    ? `${decodeURIComponent(city)}, ${country}`
    : country || null;

  const supabase = getAdminSupabase();
  await supabase.from("card_views").insert({ username, ip, location });

  return NextResponse.json({ ok: true });
}
