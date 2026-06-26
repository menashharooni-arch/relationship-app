import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { sendSms, sendBrandedEmail, buildSmsBody } from "@/lib/messaging";

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
  if (!lead || !usernames.includes(lead.card_owner)) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const { text } = await req.json();
  const body = typeof text === "string" ? text.trim() : "";
  if (!body) return NextResponse.json({ error: "Message is empty." }, { status: 400 });

  const admin = getAdminSupabase();
  const [{ data: lead }, usernames] = await Promise.all([
    admin.from("leads").select("name, email, phone, card_owner").eq("id", id).single(),
    getOwnerUsernames(user.id),
  ]);
  if (!lead || !usernames.includes(lead.card_owner)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sender identity = the card that captured this lead (fall back to profile).
  const { data: card } = await admin
    .from("cards")
    .select("name, company, phone, email, website")
    .eq("username", lead.card_owner)
    .maybeSingle();
  let sender = card as { name?: string; company?: string; phone?: string; email?: string; website?: string } | null;
  if (!sender) {
    const { data: prof } = await admin
      .from("profiles")
      .select("name, company, phone, email, website")
      .eq("username", lead.card_owner)
      .maybeSingle();
    sender = prof;
  }
  const senderName = sender?.name || "A SwiftCard user";
  const company = sender?.company || null;

  // Email first (free); SMS only when there's no email.
  let channel: "email" | "sms";
  let status: "sent" | "not_configured" | "failed";

  if (lead.email) {
    channel = "email";
    status = await sendBrandedEmail({
      to: lead.email,
      senderName,
      company,
      text: body,
      replyTo: sender?.email || null,
      phone: sender?.phone || null,
      website: sender?.website || null,
      cardUsername: lead.card_owner,
    });
  } else if (lead.phone) {
    channel = "sms";
    status = await sendSms(lead.phone, buildSmsBody({
      senderName,
      company,
      text: body,
      replyContact: sender?.phone || sender?.email || null,
    }));
  } else {
    return NextResponse.json({ error: "This contact has no email or phone on file." }, { status: 400 });
  }

  // Log to the thread (best-effort; skipped silently if table is missing).
  const createdAt = new Date().toISOString();
  const { data: inserted } = await admin
    .from("lead_messages")
    .insert({ lead_id: id, card_owner: lead.card_owner, direction: "out", channel, body, status })
    .select("id, direction, channel, body, status, created_at")
    .maybeSingle();

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

  return NextResponse.json({
    ok: true,
    channel,
    message: inserted ?? { id: createdAt, direction: "out", channel, body, status, created_at: createdAt },
  });
}
