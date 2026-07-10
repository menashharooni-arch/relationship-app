import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { buildWatchResponse } from "@/lib/watch-contract";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// GET /api/watch/card → the signed-in user's card(s) in the watch sync contract.
//
// AUTH MODEL (honest): today SwiftCard auth is a Supabase session cookie set for
// the web app. A real watchOS companion can't use that cookie, so this endpoint
// ALSO accepts the user's Supabase access token as `Authorization: Bearer <jwt>`
// — the token a native app would obtain via Supabase Auth after the user signs
// in. No new auth system is invented here; it's the same Supabase identity.
//
// This is BACKEND PREP only. There is no watchOS app in this repo and one cannot
// be shipped from a website — see docs/APPLE_WATCH.md.
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: cards } = await admin
    .from("cards")
    .select("username, name, title, company, phone, email, website, photo_url, logo_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return NextResponse.json(buildWatchResponse(cards ?? [], APP_URL), {
    headers: { "Cache-Control": "no-store" },
  });
}

// Prefer a Bearer token (native path); fall back to the web session cookie.
async function resolveUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    // Validate the JWT with Supabase — an invalid/expired token yields no user.
    const { data } = await getAdminSupabase().auth.getUser(bearer);
    return data.user?.id ?? null;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
