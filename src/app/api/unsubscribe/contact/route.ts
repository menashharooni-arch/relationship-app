import { NextRequest, NextResponse } from "next/server";
import { verifyContactUnsubToken, addOptOut } from "@/lib/messaging";

// Contact-level unsubscribe: for people who RECEIVED a follow-up from a
// SwiftCard user (they are leads, not account holders). The signed token
// carries the email; opting out adds it to message_opt_outs, which every
// email send path checks before delivering.

// GET — the footer link a person clicks.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const email = verifyContactUnsubToken(token);
  if (!email) return NextResponse.redirect(new URL("/unsubscribe?error=invalid", req.url));
  // Do NOT claim success we did not achieve: the page said "you're
  // unsubscribed" regardless of whether the row was written, and the email
  // path has no carrier-level backstop the way SMS does.
  if (!(await addOptOut("email", email))) {
    return NextResponse.redirect(new URL("/unsubscribe?error=failed", req.url));
  }
  // scope=contact so the confirmation page describes what actually happened —
  // a platform-wide email opt-out — and hides the dashboard CTAs, which a lead
  // or invitee has no account to reach.
  return NextResponse.redirect(new URL("/unsubscribe?success=1&scope=contact", req.url));
}

// POST — RFC 8058 one-click (mail clients call this from the List-Unsubscribe header).
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const email = verifyContactUnsubToken(token);
  if (!email) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  // RFC 8058 one-click. A 5xx tells the mail client the request failed, which
  // is honest and lets it retry — better than a 200 for an opt-out we dropped.
  if (!(await addOptOut("email", email))) {
    return NextResponse.json({ error: "Could not record unsubscribe" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
