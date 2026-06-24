import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const SCOPES = "crm.objects.contacts.write";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  const state = Buffer.from(user.id).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    redirect_uri: `${APP_URL}/api/integrations/hubspot/callback`,
    scope: SCOPES,
    state,
  });

  return NextResponse.redirect(`https://app.hubspot.com/oauth/authorize?${params}`);
}
