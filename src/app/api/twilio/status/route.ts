import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { reportError } from "@/lib/report-error";

// Twilio delivery-status callback.
//
// Why this exists: creating a message through the Twilio API is only an
// ACCEPTANCE. The call returns 201 with status "queued"/"accepted", the app
// says "Sent", and the row is logged — and then delivery is decided later, by
// the carrier. If the sending number's A2P 10DLC campaign isn't registered, US
// carriers DROP the message (error 30034) and the sender never finds out. That
// is exactly the "it said Sent but nothing arrived" case.
//
// Twilio POSTs here for each status transition of a message we sent (we pass
// statusCallback on create). We match on MessageSid and write the real outcome
// back onto the logged message, so the conversation thread stops claiming a
// message was delivered when it wasn't.
//
// Terminal statuses: delivered | undelivered | failed. Intermediate ones
// (queued, sending, sent) are recorded too — "sent" from Twilio still only
// means "handed to the carrier".

const TERMINAL_FAILURES = new Set(["undelivered", "failed"]);

// Statuses a message cannot move OUT of. Twilio sends one INDEPENDENT HTTP POST
// per transition (queued → sent → undelivered), and independent requests arrive
// in whatever order the network delivers them. This route wrote every callback
// unconditionally, so a straggling "queued" landing after "undelivered" reset
// the row to queued — and the thread then showed "Queued" forever for a text
// the carrier had rejected.
//
// Observed in production on 2026-08-11: three shares failed with error 30034
// (A2P 10DLC unregistered), the failures were logged, and all three rows still
// read "queued". Exactly the "never tell someone a message arrived when the
// carrier said it didn't" rule this file opens with, failing on ordering.
const TERMINAL = ["delivered", "undelivered", "failed", "canceled"];

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  // Verify the request really came from Twilio. FAIL CLOSED: without this,
  // anyone could POST fake delivery failures for arbitrary message SIDs. Same
  // signature check (and same local-dev escape hatch) as the inbound webhook.
  const skip = process.env.TWILIO_SKIP_VALIDATION === "true" && process.env.NODE_ENV !== "production";
  if (!skip) {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token) return new NextResponse("Twilio not configured", { status: 503 });
    const sig = req.headers.get("x-twilio-signature");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const url = `https://${host}/api/twilio/status`;
    if (!sig || !twilio.validateRequest(token, sig, url, params)) {
      return new NextResponse("Invalid signature", { status: 403 });
    }
  }

  const sid = params.MessageSid || params.SmsSid || "";
  const status = (params.MessageStatus || params.SmsStatus || "").toLowerCase();
  const errorCode = params.ErrorCode || null;
  if (!sid || !status) return NextResponse.json({ ok: true });

  try {
    const admin = getAdminSupabase();
    let q = admin
      .from("lead_messages")
      .update({ status, ...(errorCode ? { error_code: errorCode } : {}) })
      .eq("provider_sid", sid);

    // A terminal status always wins. A non-terminal one may only land on a row
    // that has not already reached a terminal state.
    //
    // The null arm is required, not defensive: in PostgREST `status.neq.failed`
    // evaluates to NULL — not true — for a row whose status IS NULL, so without
    // it every freshly-inserted message (status NULL) would be excluded and the
    // first callback would never apply.
    if (!TERMINAL.includes(status)) {
      q = q.or(`status.is.null,and(${TERMINAL.map((s) => `status.neq.${s}`).join(",")})`);
    }
    const { data: updated } = await q.select("id");

    // A delivery failure is an ops signal, not a user error: it usually means
    // the whole sending number is misconfigured (30034 = A2P 10DLC campaign not
    // registered), so EVERY text is failing, not just this one. Surface it once
    // per failed message rather than letting it disappear.
    if (TERMINAL_FAILURES.has(status) && (updated?.length ?? 0) > 0) {
      await reportError(
        "sms.delivery-failed",
        new Error(`Twilio reported ${status}${errorCode ? ` (error ${errorCode})` : ""} for message ${sid}`),
      );
    }
  } catch (e) {
    await reportError("twilio.status-callback", e).catch(() => {});
  }

  // Always 200 — a non-2xx makes Twilio retry a callback we can't act on.
  return NextResponse.json({ ok: true });
}
