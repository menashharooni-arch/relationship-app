import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isPaidPlan } from "@/lib/plan";
import { signState } from "@/lib/oauth-state";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Salesforce OAuth 2.0 web-server flow. Mirrors google/connect exactly:
// signed state, paid gate, native-shell cookie. Scopes: `api` (data access)
// + `refresh_token` (offline). Login host is production — sandbox orgs
// (test.salesforce.com) are deliberately out of scope for v1.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  // Integrations are a Pro/Office feature.
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!isPaidPlan(profile?.plan)) return NextResponse.redirect(`${APP_URL}/pricing`);

  // Not configured yet (Connected App credentials pending) — land back on
  // Settings with a clear status instead of a broken Salesforce URL.
  if (!process.env.SALESFORCE_CLIENT_ID) {
    return NextResponse.redirect(`${APP_URL}/settings/flows?integration=salesforce&status=unconfigured`);
  }

  const state = signState(user.id);
  const params = new URLSearchParams({
    client_id: process.env.SALESFORCE_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/integrations/salesforce/callback`,
    response_type: "code",
    scope: "api refresh_token",
    state,
  });

  const res = NextResponse.redirect(`https://login.salesforce.com/services/oauth2/authorize?${params}`);
  // Same native-shell return leg as Google — see google/connect.
  if (new URL(request.url).searchParams.get("native") === "1") {
    res.cookies.set("sf_native", "1", { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  }
  return res;
}
