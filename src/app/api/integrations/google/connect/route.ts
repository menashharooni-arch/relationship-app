import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isPaidPlan } from "@/lib/plan";

const SCOPES = "https://www.googleapis.com/auth/contacts";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  // Integrations are a Pro/Office feature.
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!isPaidPlan(profile?.plan)) return NextResponse.redirect(`${APP_URL}/pricing`);

  const state = Buffer.from(user.id).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${APP_URL}/api/integrations/google/callback`,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
