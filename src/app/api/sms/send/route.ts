import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import twilio from "twilio";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "No message" }, { status: 400 });

  const adminSupabase = getAdminSupabase();
  const [{ data: lead }, usernames] = await Promise.all([
    adminSupabase.from("leads").select("phone, card_owner").eq("id", leadId).single(),
    getOwnerUsernames(user.id),
  ]);

  if (!lead?.phone) return NextResponse.json({ error: "Lead has no phone number" }, { status: 400 });
  if (!usernames.includes(lead.card_owner)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return NextResponse.json({ error: "twilio_not_configured" }, { status: 503 });
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  await client.messages.create({
    body: message.trim(),
    from: TWILIO_PHONE_NUMBER,
    to: lead.phone,
  });

  return NextResponse.json({ success: true });
}
