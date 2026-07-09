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
  await addOptOut("email", email);
  return NextResponse.redirect(new URL("/unsubscribe?success=1", req.url));
}

// POST — RFC 8058 one-click (mail clients call this from the List-Unsubscribe header).
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const email = verifyContactUnsubToken(token);
  if (!email) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  await addOptOut("email", email);
  return NextResponse.json({ success: true });
}
