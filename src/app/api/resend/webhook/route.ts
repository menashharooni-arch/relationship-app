import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { addOptOut } from "@/lib/messaging";
import { reportError } from "@/lib/report-error";

// Resend delivery webhook — the feedback loop that keeps a young sending domain
// alive.
//
// Until this existed, nothing ever told the app that an address had hard-bounced
// or that a recipient had hit "Report spam". Both lists stayed empty, so we kept
// mailing dead addresses and people who had explicitly complained. That is the
// fastest way to lose a domain: mailbox providers read continued sending after a
// permanent bounce as a list-hygiene failure, and Gmail's published threshold for
// spam complaints is 0.3% — at our volume that is a handful of clicks.
//
// Suppression is written to message_opt_outs via addOptOut(), which is the SAME
// list the broadcast, lead, invite and follow-up senders already consult. One
// list, checked everywhere — a second parallel list is how the two unsubscribe
// endpoints previously drifted apart.
//
// Setup: Resend → Webhooks → add endpoint https://swiftcard.me/api/resend/webhook
// for email.bounced + email.complained, then put the signing secret in
// RESEND_WEBHOOK_SECRET.

export const runtime = "nodejs";

// Svix signature scheme, verified by hand rather than pulling in the `svix`
// package for ~15 lines. Signed content is `${id}.${timestamp}.${rawBody}`, so
// the RAW body is required — parsing first and re-serialising would change the
// bytes and every signature would fail.
function verify(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) return false;

  // Replay window. Svix's own tolerance is 5 minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  // The header may carry several space-separated versioned signatures during a
  // secret rotation; any one matching is a pass.
  return sigHeader.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

type ResendEvent = {
  type?: string;
  data?: {
    to?: string | string[];
    email_id?: string;
    bounce?: { type?: string; subType?: string };
  };
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Refuse rather than accept unverified events: an unauthenticated caller
    // could otherwise suppress any address it liked, which is a denial-of-email
    // against our own users.
    await reportError("resend.webhook.no-secret", "RESEND_WEBHOOK_SECRET is unset — bounce/complaint suppression is not running");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const raw = await req.text();
  if (!verify(raw, req.headers, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const recipients = Array.isArray(event.data?.to)
    ? event.data.to
    : event.data?.to
      ? [event.data.to]
      : [];
  if (!recipients.length) return NextResponse.json({ ok: true, note: "no recipient" });

  // A transient bounce is a full mailbox or a temporary server fault — the
  // address is still good and suppressing it would silently cut off a paying
  // user. Only a permanent failure means the address does not exist.
  const isPermanentBounce =
    event.type === "email.bounced" &&
    (event.data?.bounce?.type ?? "").toLowerCase() !== "transient";

  const isComplaint = event.type === "email.complained";

  if (!isPermanentBounce && !isComplaint) {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const reason = isComplaint ? "complaint" : "hard-bounce";
  const failed: string[] = [];
  for (const address of recipients) {
    const ok = await addOptOut("email", address);
    if (!ok) failed.push(address);
  }

  // addOptOut already retries once. A failure here means the suppression did NOT
  // land and we will keep mailing an address that bounced or complained — report
  // it loudly rather than returning a cheerful 200 that hides it.
  if (failed.length) {
    await reportError(
      "resend.webhook.suppression-failed",
      `${failed.length} address(es) still mailable after a ${reason}`,
      { reason, count: failed.length, event: event.type },
    );
    return NextResponse.json({ error: "suppression failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, suppressed: recipients.length, reason });
}
