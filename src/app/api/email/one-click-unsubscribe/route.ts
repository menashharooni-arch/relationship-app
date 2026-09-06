import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email-token";
import { recordOptOut } from "@/lib/marketing-consent";

// ── RFC 8058 one-click unsubscribe ──────────────────────────────────────────
//
// This is the endpoint behind `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
// Gmail, Yahoo and Outlook POST here when someone taps the unsubscribe control
// the MAIL CLIENT draws — the person never sees our UI and never will.
//
// The contract, and every part of it is load-bearing:
//   • POST, and it must run real code. It must NOT redirect: a provider follows
//     a 3xx and scores the result, and a redirect to a page is how an opt-out
//     gets recorded as honoured while the mail keeps coming.
//   • Answer inside 2 seconds. Providers time out and retry; a slow endpoint
//     looks broken and the next step is a spam classification for the domain.
//   • Take effect immediately, not on the next campaign build.
//   • No UI, no body worth reading, no login, no confirmation step. Asking a
//     mail client to confirm is the same as refusing.
//
// This must stay a ROUTE HANDLER. In Next 16 a urlencoded POST to a PAGE is
// classified as a possible Server Action, skips the 405 branch and is answered
// by the static prerender without running any code — the provider sees 200 and
// nothing happens. That exact bug shipped here once before; see unsubUrl() in
// lib/email-templates.ts.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Every failure answers the same way: no oracle for whether a user id exists.
const DONE = () => NextResponse.json({ ok: true }, { status: 200 });

export async function POST(req: NextRequest) {
  // The token rides in the query string because the URL is what goes in the
  // header — providers post an empty or form-encoded body and we must not
  // depend on it.
  const token = req.nextUrl.searchParams.get("t") ?? req.nextUrl.searchParams.get("token");
  const check = verifyEmailToken(token);

  if (!check.ok) {
    // 400 for a token we cannot read at all, so a genuinely broken link is
    // visible in logs rather than silently "succeeding" forever.
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const stopped = await recordOptOut({ userId: check.userId, source: "one_click_header" });
  // A write failure is OUR problem, and a 5xx invites the provider to retry —
  // which is what we want, because the person's request is not yet honoured.
  if (!stopped) return NextResponse.json({ ok: false }, { status: 503 });

  return DONE();
}

// Some clients probe with GET before POSTing. Answer, do not redirect, and do
// not act: a GET must never mutate, or a link scanner in a corporate mail
// gateway unsubscribes people who merely received the message.
export async function GET() {
  return NextResponse.json({ ok: true, method: "POST" }, { status: 200 });
}
