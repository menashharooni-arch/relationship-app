import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isPaidPlan } from "@/lib/plan";
import { signState } from "@/lib/oauth-state";

export const runtime = "nodejs";

const SCOPES = "https://www.googleapis.com/auth/contacts";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  // Integrations are a Pro/Office feature.
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!isPaidPlan(profile?.plan)) return NextResponse.redirect(`${APP_URL}/pricing`);

  const state = signState(user.id);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${APP_URL}/api/integrations/google/callback`,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);

  // `?native=1` — started from the iOS shell, which runs this in an in-app
  // browser because accounts.google.com is not in capacitor.config's
  // allowNavigation (and Google blocks embedded-webview OAuth anyway). The
  // callback reads this cookie to finish at a swiftcard:// URL that re-opens
  // the app, instead of an https one that strands the user on the website with
  // the app still showing "Connect". Google's registered redirect_uri is fixed,
  // so nothing about this run can ride in the URL. Same shape as LinkedIn.
  if (new URL(request.url).searchParams.get("native") === "1") {
    res.cookies.set("g_native", "1", { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  }
  return res;
}
