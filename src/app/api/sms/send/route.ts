import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { deliverToLead } from "@/lib/messaging";
import { isRateLimited } from "@/lib/rate-limit";

// Send a one-off text to a contact (the "Send SMS" button on AI messages).
// Goes through the shared delivery path so STOP opt-outs are respected, the
// Messaging Service is used when configured, the sender identity is the CARD
// the contact came through, and the message lands in the conversation thread.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Every send is a real Twilio charge — cap per account so a compromised or
  // scripted session can't run up an unbounded SMS bill.
  if (isRateLimited(`sms-send:${user.id}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many texts sent — try again in a few minutes." }, { status: 429 });
  }

  const { leadId, message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "No message" }, { status: 400 });

  const admin = getAdminSupabase();
  const [{ data: lead }, usernames] = await Promise.all([
    admin.from("leads").select("name, phone, card_owner").eq("id", leadId).single(),
    getOwnerUsernames(user.id),
  ]);

  if (!lead?.phone) return NextResponse.json({ error: "Lead has no phone number" }, { status: 400 });
  if (!usernames.includes(lead.card_owner)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Sender identity = the card that captured this contact (legacy: profile slug).
  const { data: card } = await admin
    .from("cards")
    .select("name, company, phone, email")
    .eq("username", lead.card_owner)
    .maybeSingle();
  let sender = card as { name?: string; company?: string; phone?: string; email?: string } | null;
  if (!sender) {
    const { data: prof } = await admin
      .from("profiles")
      .select("name, company, phone, email")
      .eq("username", lead.card_owner)
      .maybeSingle();
    sender = prof;
  }

  const result = await deliverToLead({
    leadId,
    cardOwner: lead.card_owner,
    lead: { phone: lead.phone, email: null, name: lead.name },
    sender: {
      name: sender?.name || null,
      company: sender?.company || null,
      phone: sender?.phone || null,
      email: sender?.email || null,
      website: null,
    },
    text: message.trim(),
    cardUsername: lead.card_owner,
    channel: "sms",
  });

  if (result.status === "opted_out") {
    return NextResponse.json({ error: "opted_out", message: "This contact opted out of texts (replied STOP)." }, { status: 409 });
  }
  if (result.status === "not_configured") {
    return NextResponse.json({ error: "twilio_not_configured" }, { status: 503 });
  }
  if (result.status !== "sent") {
    return NextResponse.json({ error: "failed", message: "Couldn't send the text. Check the phone number and try again." }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
