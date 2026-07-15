import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { addOptOut, removeOptOut, normalizePhone, logMessage } from "@/lib/messaging";

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "stop all"]);
const START_WORDS = new Set(["start", "unstop", "yes", "unsubscribe off"]);

function twiml(message?: string) {
  const body = message
    ? `<Response><Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Message></Response>`
    : `<Response></Response>`;
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// Twilio posts inbound SMS here (set this URL as the Messaging Service inbound webhook).
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  // Verify the request really came from Twilio (signed with your auth token).
  // FAIL CLOSED: without a configured auth token, an unsigned request could
  // forge inbound SMS to manipulate the opt-out list or inject into a thread.
  // In production we require the token + a valid signature; the skip flag is
  // honored only outside production (local testing).
  const skip = process.env.TWILIO_SKIP_VALIDATION === "true" && process.env.NODE_ENV !== "production";
  if (!skip) {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token) {
      return new NextResponse("Twilio not configured", { status: 503 });
    }
    const sig = req.headers.get("x-twilio-signature");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const url = `https://${host}/api/twilio/inbound`;
    if (!sig || !twilio.validateRequest(token, sig, url, params)) {
      return new NextResponse("Invalid signature", { status: 403 });
    }
  }

  const from = params.From || "";
  const bodyText = (params.Body || "").trim();
  const keyword = bodyText.toLowerCase();

  // STOP / START keyword handling (carrier + our own suppression list).
  if (STOP_WORDS.has(keyword)) {
    await addOptOut("sms", from);
    return twiml(); // Twilio Advanced Opt-Out sends the confirmation; stay silent.
  }
  if (START_WORDS.has(keyword)) {
    await removeOptOut("sms", from);
    return twiml();
  }

  // Otherwise it's a real reply — log it into the matching contact's thread.
  const digits = normalizePhone(from);
  if (digits.length >= 7) {
    try {
      const admin = getAdminSupabase();
      const { data: leads } = await admin
        .from("leads")
        .select("id, card_owner, phone")
        .ilike("phone", `%${digits.slice(-7)}%`)
        .limit(25);
      const matches = (leads ?? []).filter((l) => l.phone && normalizePhone(l.phone) === digits);
      for (const lead of matches) {
        await logMessage({ leadId: lead.id, cardOwner: lead.card_owner, direction: "in", channel: "sms", body: bodyText, status: "received" });
      }
    } catch { /* ignore */ }
  }

  return twiml();
}
