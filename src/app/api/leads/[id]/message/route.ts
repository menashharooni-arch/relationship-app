import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { ownsLead } from "@/lib/lead-access";
import { deliverToLead } from "@/lib/messaging";
import { isPaidPlan } from "@/lib/plan";

// GET — the conversation thread (outbound messages you've sent this contact).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const [{ data: lead }, usernames] = await Promise.all([
    admin.from("leads").select("card_owner").eq("id", id).single(),
    getOwnerUsernames(user.id),
  ]);
  if (!ownsLead(usernames, lead)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Table may not exist before the migration is run — degrade to empty thread.
  const { data: messages } = await admin
    .from("lead_messages")
    .select("id, direction, channel, body, status, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: messages ?? [] });
}

// POST — send a message to the contact via email (free, preferred) or SMS
// (one shared SwiftCard number). Branded so they know who it's from.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, channel: reqChannel, subject } = await req.json();
  const body = typeof text === "string" ? text.trim() : "";
  if (!body) return NextResponse.json({ error: "Message is empty." }, { status: 400 });
  const preferChannel = reqChannel === "sms" || reqChannel === "email" ? reqChannel : undefined;

  const admin = getAdminSupabase();
  const [{ data: lead }, usernames] = await Promise.all([
    admin.from("leads").select("name, email, phone, card_owner").eq("id", id).single(),
    getOwnerUsernames(user.id),
  ]);
  if (!ownsLead(usernames, lead)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sender identity = the card that captured this lead (fall back to profile).
  const { data: card } = await admin
    .from("cards")
    .select("name, title, company, phone, email, website")
    .eq("username", lead.card_owner)
    .maybeSingle();
  let sender = card as { name?: string; title?: string; company?: string; phone?: string; email?: string; website?: string } | null;
  if (!sender) {
    const { data: prof } = await admin
      .from("profiles")
      .select("name, title, company, phone, email, website")
      .eq("username", lead.card_owner)
      .maybeSingle();
    sender = prof;
  }
  // Paid senders get no SwiftCard branding on the message they send.
  const { data: senderPlan } = await admin.from("profiles").select("plan").eq("id", user.id).maybeSingle();

  const result = await deliverToLead({
    leadId: id,
    cardOwner: lead.card_owner,
    lead: { email: lead.email, phone: lead.phone, name: lead.name },
    sender: {
      name: sender?.name || null,
      title: sender?.title || null,
      company: sender?.company || null,
      phone: sender?.phone || null,
      email: sender?.email || null,
      website: sender?.website || null,
    },
    text: body,
    subject: typeof subject === "string" ? subject : null,
    cardUsername: lead.card_owner,
    channel: preferChannel,
    senderPaid: isPaidPlan(senderPlan?.plan as string | null),
  });
  const { channel, status } = result;

  if (status === "no_contact") {
    return NextResponse.json({ error: "This contact has no email or phone on file." }, { status: 400 });
  }
  if (status === "opted_out") {
    return NextResponse.json({ error: "opted_out", channel, message: `This contact opted out of ${channel === "sms" ? "texts" : "emails"}.` }, { status: 409 });
  }
  if (status === "not_configured") {
    return NextResponse.json(
      {
        error: "not_configured",
        channel,
        message: channel === "sms"
          ? "Texting isn't switched on yet — add your Twilio keys + Messaging Service SID to send SMS."
          : "Email isn't switched on yet — add your Resend API key to send emails.",
      },
      { status: 503 },
    );
  }
  if (status === "failed") {
    return NextResponse.json({ error: "failed", channel, message: "Couldn't deliver the message. Please try again." }, { status: 502 });
  }

  const createdAt = new Date().toISOString();
  return NextResponse.json({
    ok: true,
    channel,
    message: { id: createdAt, direction: "out", channel, body, status: "sent", created_at: createdAt },
  });
}
